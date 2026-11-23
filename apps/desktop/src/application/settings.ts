import { markRaw } from 'vue'
import type { PiniaPlugin } from 'pinia'
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
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  theme: 'system',
  extraExclusions: [],
  defaultDepth: 2,
  autoUpdate: true,
  betaUpdates: false,
}

/** Porta de persistência das preferências. */
export interface SettingsStorage {
  load(): unknown
  save(settings: Settings): void
}

const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

/** Valida o que veio do armazenamento: campo inválido volta ao padrão. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const list = Array.isArray(r.extraExclusions) ? r.extraExclusions : []
  const exclusions = [
    ...new Set(list.filter((p): p is string => typeof p === 'string').map((p) => p.trim()).filter(Boolean)),
  ]
  return {
    language: pick(r.language, ['auto', 'pt', 'en'] as const, DEFAULT_SETTINGS.language),
    theme: pick(r.theme, ['system', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme),
    extraExclusions: exclusions,
    defaultDepth: pick(r.defaultDepth, [1, 2] as const, DEFAULT_SETTINGS.defaultDepth),
    autoUpdate: flag(r.autoUpdate, DEFAULT_SETTINGS.autoUpdate),
    betaUpdates: flag(r.betaUpdates, DEFAULT_SETTINGS.betaUpdates),
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
