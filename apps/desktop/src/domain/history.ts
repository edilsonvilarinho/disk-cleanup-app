// Histórico de varreduras: retrato compacto de cada survey e regras de
// comparação. Puro (sem I/O): persistência e relógio entram por fora.

import type { SurveyDto, UsageEntryDto } from './models'

export const HISTORY_LIMIT = 100
/** Variação menor que isso (≈0,05 GiB) não entra na comparação. */
export const MIN_DELTA_BYTES = Math.round(0.05 * 1024 ** 3)
export const DIFF_LIMIT = 10

export interface SnapshotEntry {
  /** Caminho relativo (`key` do núcleo unido por `/`): identidade estável entre varreduras. */
  key: string
  name: string
  bytes: number
}

export interface ScanSnapshot {
  id: string
  /** ISO 8601. */
  at: string
  volumeRoot: string
  profilePath: string | null
  depth: 1 | 2
  totalBytes: number
  usedBytes: number
  freeBytes: number
  files: number
  unreadable: number
  elapsedMs: number
  /** 1º nível do volume e do perfil, completos (sem corte): comparação exata. */
  roots: SnapshotEntry[]
  profile: SnapshotEntry[]
}

export interface SnapshotContext {
  id: string
  at: Date
  volumeRoot: string
  profilePath: string | null
  depth: 1 | 2
}

const entries = (list: UsageEntryDto[]): SnapshotEntry[] =>
  list.map((e) => ({ key: e.key.join('/'), name: e.name, bytes: e.logicalBytes }))

export function toSnapshot(survey: SurveyDto, ctx: SnapshotContext): ScanSnapshot {
  return {
    id: ctx.id,
    at: ctx.at.toISOString(),
    volumeRoot: ctx.volumeRoot,
    profilePath: ctx.profilePath,
    depth: ctx.depth,
    totalBytes: survey.volume.totalBytes,
    usedBytes: survey.volume.usedBytes,
    freeBytes: survey.volume.freeBytes,
    files: survey.files,
    unreadable: survey.unreadable,
    elapsedMs: survey.elapsedMs,
    roots: entries(survey.roots),
    profile: entries(survey.profile),
  }
}

/** Ordem cronológica; acima do limite, a mais antiga sai primeiro. */
export function appendSnapshot(list: readonly ScanSnapshot[], snapshot: ScanSnapshot, limit = HISTORY_LIMIT): ScanSnapshot[] {
  return sortByDate([...list, snapshot]).slice(-limit)
}

const sortByDate = (list: ScanSnapshot[]): ScanSnapshot[] => list.sort((a, b) => a.at.localeCompare(b.at))

export interface EntryDelta {
  key: string
  name: string
  before: number
  after: number
  delta: number
  /** Não existia na varredura de origem. */
  added: boolean
  /** Não existe na varredura de destino. */
  removed: boolean
}

/** Maiores variações absolutas entre duas listas, ignorando ruído abaixo de `minBytes`. */
export function compareEntries(
  from: readonly SnapshotEntry[],
  to: readonly SnapshotEntry[],
  minBytes = MIN_DELTA_BYTES,
  limit = DIFF_LIMIT,
): EntryDelta[] {
  const before = new Map(from.map((e) => [e.key, e]))
  const after = new Map(to.map((e) => [e.key, e]))
  const keys = new Set([...before.keys(), ...after.keys()])
  const out: EntryDelta[] = []
  for (const key of keys) {
    const a = before.get(key)
    const b = after.get(key)
    const delta = (b?.bytes ?? 0) - (a?.bytes ?? 0)
    if (Math.abs(delta) < minBytes) continue
    out.push({ key, name: (b ?? a)!.name, before: a?.bytes ?? 0, after: b?.bytes ?? 0, delta, added: !a, removed: !b })
  }
  return out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || x.name.localeCompare(y.name)).slice(0, limit)
}

export interface Comparison {
  usedDelta: number
  freeDelta: number
  filesDelta: number
  days: number
  roots: EntryDelta[]
  /** `null` quando os perfis são diferentes: comparar seria enganoso. */
  profile: EntryDelta[] | null
}

const DAY_MS = 86_400_000

export function compareSnapshots(from: ScanSnapshot, to: ScanSnapshot): Comparison {
  return {
    usedDelta: to.usedBytes - from.usedBytes,
    freeDelta: to.freeBytes - from.freeBytes,
    filesDelta: to.files - from.files,
    days: Math.round((Date.parse(to.at) - Date.parse(from.at)) / DAY_MS),
    roots: compareEntries(from.roots, to.roots),
    profile: from.profilePath === to.profilePath ? compareEntries(from.profile, to.profile) : null,
  }
}

// ---------- Validação do que vem do armazenamento ----------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

function sanitizeEntries(raw: unknown): SnapshotEntry[] | null {
  if (!Array.isArray(raw)) return null
  const out: SnapshotEntry[] = []
  for (const e of raw) {
    const r = (e ?? {}) as Record<string, unknown>
    if (!isStr(r.key) || !isStr(r.name) || !isNum(r.bytes)) return null
    out.push({ key: r.key, name: r.name, bytes: r.bytes })
  }
  return out
}

function sanitizeSnapshot(raw: unknown): ScanSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const roots = sanitizeEntries(r.roots)
  const profile = sanitizeEntries(r.profile)
  const numbers = [r.totalBytes, r.usedBytes, r.freeBytes, r.files, r.unreadable, r.elapsedMs]
  if (
    !isStr(r.id) || !isStr(r.at) || Number.isNaN(Date.parse(r.at)) || !isStr(r.volumeRoot) ||
    !(r.profilePath === null || isStr(r.profilePath)) || (r.depth !== 1 && r.depth !== 2) ||
    !numbers.every(isNum) || !roots || !profile
  ) {
    return null
  }
  return {
    id: r.id,
    at: r.at,
    volumeRoot: r.volumeRoot,
    profilePath: r.profilePath as string | null,
    depth: r.depth,
    totalBytes: r.totalBytes as number,
    usedBytes: r.usedBytes as number,
    freeBytes: r.freeBytes as number,
    files: r.files as number,
    unreadable: r.unreadable as number,
    elapsedMs: r.elapsedMs as number,
    roots,
    profile,
  }
}

/** Descarta registros corrompidos sem perder os válidos; ids repetidos ficam com o primeiro. */
export function sanitizeHistory(raw: unknown): ScanSnapshot[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const valid: ScanSnapshot[] = []
  for (const item of raw) {
    const snap = sanitizeSnapshot(item)
    if (!snap || seen.has(snap.id)) continue
    seen.add(snap.id)
    valid.push(snap)
  }
  return sortByDate(valid).slice(-HISTORY_LIMIT)
}
