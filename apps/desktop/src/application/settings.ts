import { markRaw } from 'vue'
import type { PiniaPlugin } from 'pinia'
import type { UserRule } from '../domain/models'
import type { ScanSchedule } from '../domain/monitor'
import type { LanguagePreference } from '../i18n/i18n'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface Settings {
  language: LanguagePreference
  theme: ThemeMode
  /** Pastas protegidas pelo usuário; somam às exclusões obrigatórias. */
  extraExclusions: string[]
  defaultDepth: 1 | 2
  /** Verifica e baixa ao abrir; vem ligada na instalação. */
  autoUpdate: boolean
  /** Inclui as versões beta (prereleases) na busca. */
  betaUpdates: boolean
  /** Pastas de projetos além das padrão do catálogo. */
  projectRoots: string[]
  /** Projeto só começa marcado com ao menos estes dias sem atividade. */
  minIdleDays: MinIdleDays
  /** Regras próprias (validadas pelo núcleo antes de salvar). */
  userRules: UserRule[]
  /** Perfis de projeto desligados (`node`, `rust`...). */
  disabledProfiles: string[]
  /** Procurar sobras de apps desinstalados (experimental). */
  findOrphans: boolean
  /** Ícone na bandeja; fechar a janela mantém o app nela. */
  backgroundEnabled: boolean
  /** Avisar quando o livre ficar abaixo de N GB (0 = desligado). */
  lowSpaceGb: LowSpaceGb
  /** Varredura agendada, somente leitura. */
  schedule: ScanSchedule
}

export const LOW_SPACE_OPTIONS = [0, 10, 15, 25, 50] as const
export type LowSpaceGb = (typeof LOW_SPACE_OPTIONS)[number]
export const SCHEDULE_OPTIONS: readonly ScanSchedule[] = ['off', 'daily', 'weekly', 'monthly']

export const MIN_IDLE_OPTIONS = [30, 90, 180, 365] as const
export type MinIdleDays = (typeof MIN_IDLE_OPTIONS)[number]

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  theme: 'system',
  extraExclusions: [],
  defaultDepth: 2,
  autoUpdate: true,
  betaUpdates: false,
  projectRoots: [],
  minIdleDays: 90,
  userRules: [],
  disabledProfiles: [],
  findOrphans: false,
  backgroundEnabled: false,
  lowSpaceGb: 15,
  schedule: 'off',
}

/** Porta de persistência das preferências. */
export interface SettingsStorage {
  load(): unknown
  save(settings: Settings): void
}

const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

/** Regra própria válida: pasta não vazia, tier A ou C, sem repetir pasta. */
function rules(value: unknown): UserRule[] {
  const list = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  return list.flatMap((r): UserRule[] => {
    const o = (typeof r === 'object' && r !== null ? r : {}) as Record<string, unknown>
    const path = typeof o.path === 'string' ? o.path.trim() : ''
    const tier = o.tier === 'A' || o.tier === 'C' ? o.tier : null
    if (!path || !tier || seen.has(path.toLowerCase())) return []
    seen.add(path.toLowerCase())
    return [{ label: typeof o.label === 'string' ? o.label.trim() : '', path, tier }]
  })
}

/** Valida o que veio do armazenamento: campo inválido volta ao padrão. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const paths = (value: unknown): string[] => {
    const list = Array.isArray(value) ? value : []
    return [...new Set(list.filter((p): p is string => typeof p === 'string').map((p) => p.trim()).filter(Boolean))]
  }
  const exclusions = paths(r.extraExclusions)
  return {
    language: pick(r.language, ['auto', 'pt', 'en'] as const, DEFAULT_SETTINGS.language),
    theme: pick(r.theme, ['system', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme),
    extraExclusions: exclusions,
    defaultDepth: pick(r.defaultDepth, [1, 2] as const, DEFAULT_SETTINGS.defaultDepth),
    autoUpdate: flag(r.autoUpdate, DEFAULT_SETTINGS.autoUpdate),
    betaUpdates: flag(r.betaUpdates, DEFAULT_SETTINGS.betaUpdates),
    projectRoots: paths(r.projectRoots),
    minIdleDays: pick(r.minIdleDays, MIN_IDLE_OPTIONS, DEFAULT_SETTINGS.minIdleDays),
    userRules: rules(r.userRules),
    disabledProfiles: paths(r.disabledProfiles),
    findOrphans: flag(r.findOrphans, DEFAULT_SETTINGS.findOrphans),
    backgroundEnabled: flag(r.backgroundEnabled, DEFAULT_SETTINGS.backgroundEnabled),
    lowSpaceGb: pick(r.lowSpaceGb, LOW_SPACE_OPTIONS, DEFAULT_SETTINGS.lowSpaceGb),
    schedule: pick(r.schedule, SCHEDULE_OPTIONS, DEFAULT_SETTINGS.schedule),
  }
}

declare module 'pinia' {
  export interface PiniaCustomProperties {
    settingsStorage: SettingsStorage
  }
}

export function settingsPlugin(storage: SettingsStorage): PiniaPlugin {
  const raw = markRaw(storage)
  return () => ({ settingsStorage: raw })
}
