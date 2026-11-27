// Notas de versão: o que mostrar depois de uma atualização. Puro, sem I/O.
import type { TextDto } from './models'

export type NoteKind = 'new' | 'fixed' | 'known'
export const NOTE_KINDS: readonly NoteKind[] = ['new', 'fixed', 'known']

/** Telas sempre acessíveis; etapas trancadas do fluxo não entram aqui. */
export type NoteRoute = 'survey' | 'history' | 'settings'

/** GIF gravado do modo demonstração (`scripts/record-readme-media.mjs`). */
export interface NoteMedia {
  src: string
  alt: TextDto
}

/** Correção mostrada como antes/agora sobre o mesmo alvo. */
export interface NoteFix {
  target: string
  detail: string
  before: TextDto
  after: TextDto
}

export interface ReleaseNoteItem {
  id: string
  kind: NoteKind
  experimental?: boolean
  /** Onde a mudança mora ("Plano › Destino"). */
  area: TextDto
  title: TextDto
  body: TextDto
  route?: NoteRoute
  media?: NoteMedia
  fix?: NoteFix
}

export interface ReleaseNotes {
  version: string
  /** AAAA-MM-DD da publicação. */
  date: string
  headline: TextDto
  summary: TextDto
  items: ReleaseNoteItem[]
}

// SemVer 2.0: núcleo sem zero à esquerda, prerelease opcional, build ignorado.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/

interface Parsed {
  core: [number, number, number]
  pre: string[]
}

function parse(version: string): Parsed | null {
  const m = SEMVER.exec(version)
  if (!m) return null
  return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split('.') : [] }
}

export const isVersion = (version: string): boolean => parse(version) !== null

function compareIdentifier(a: string, b: string): number {
  const na = /^\d+$/.test(a)
  const nb = /^\d+$/.test(b)
  if (na && nb) return Number(a) - Number(b)
  if (na !== nb) return na ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

/** Precedência SemVer; `null` se algum lado não é versão. */
export function compareVersions(a: string, b: string): number | null {
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    const d = pa.core[i]! - pb.core[i]!
    if (d !== 0) return d
  }
  // Sem prerelease vem depois de qualquer prerelease da mesma versão.
  if (!pa.pre.length || !pb.pre.length) return pb.pre.length - pa.pre.length
  for (let i = 0; i < Math.min(pa.pre.length, pb.pre.length); i++) {
    const d = compareIdentifier(pa.pre[i]!, pb.pre[i]!)
    if (d !== 0) return d
  }
  return pa.pre.length - pb.pre.length
}

const after = (a: string, b: string): boolean => (compareVersions(a, b) ?? 0) > 0

/** Notas de `seen` (exclusiva) até `current` (inclusiva), a mais nova primeiro. */
export function notesBetween(catalog: readonly ReleaseNotes[], seen: string, current: string): ReleaseNotes[] {
  return catalog
    .filter((n) => after(n.version, seen) && !after(n.version, current))
    .sort((a, b) => compareVersions(b.version, a.version) ?? 0)
}

export interface NotesState {
  /** Última versão cujas notas a pessoa viu (ou que estava instalada sem notas). */
  seen: string | null
  /** Já usava o app antes (preferências ou histórico salvos). */
  existingUser: boolean
  /** "Mostrar novidades depois de atualizar". */
  enabled: boolean
}

export interface NotesDecision {
  show: ReleaseNotes[]
  /** Versão a gravar já como vista (nada para mostrar). Com notas, grava ao abrir ou dispensar. */
  markSeen: string | null
}

/** Decide, na abertura, se há notas para mostrar. */
export function decideNotes(catalog: readonly ReleaseNotes[], current: string, state: NotesState): NotesDecision {
  if (!isVersion(current)) return { show: [], markSeen: null }
  const seen = state.seen !== null && isVersion(state.seen) ? state.seen : null
  if (seen !== null && !after(current, seen)) return { show: [], markSeen: null }
  // Instalação nova não tem "novidade"; quem já usava sem versão vista ganha só a atual.
  if (seen === null && !state.existingUser) return { show: [], markSeen: current }
  const show = seen === null ? catalog.filter((n) => compareVersions(n.version, current) === 0) : notesBetween(catalog, seen, current)
  if (!state.enabled || !show.length) return { show: [], markSeen: current }
  return { show, markSeen: null }
}

export function countKinds(releases: readonly ReleaseNotes[]): Record<NoteKind, number> {
  const counts: Record<NoteKind, number> = { new: 0, fixed: 0, known: 0 }
  for (const r of releases) for (const item of r.items) counts[item.kind]++
  return counts
}
