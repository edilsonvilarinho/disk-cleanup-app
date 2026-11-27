import { defineStore } from 'pinia'
import type { LanguagePreference } from '../../i18n/i18n'
import { DEFAULT_SETTINGS, sanitizeSettings, type MinIdleDays, type Settings, type ThemeMode } from '../settings'

/** Acrescenta caminho aparado; `null` se vazio ou já existente (sem diferenciar maiúsculas). */
function addPath(list: readonly string[], path: string): string[] | null {
  const value = path.trim()
  if (!value || list.some((p) => p.toLowerCase() === value.toLowerCase())) return null
  return [...list, value]
}

export const useSettingsStore = defineStore('settings', {
  state: (): Settings => ({ ...DEFAULT_SETTINGS, extraExclusions: [], projectRoots: [] }),
  actions: {
    load() {
      this.$patch(sanitizeSettings(this.settingsStorage.load()))
    },
    persist() {
      this.settingsStorage.save({
        language: this.language,
        theme: this.theme,
        extraExclusions: [...this.extraExclusions],
        defaultDepth: this.defaultDepth,
        autoUpdate: this.autoUpdate,
        betaUpdates: this.betaUpdates,
        projectRoots: [...this.projectRoots],
        minIdleDays: this.minIdleDays,
      })
    },
    setLanguage(language: LanguagePreference) {
      this.language = language
      this.persist()
    },
    setTheme(theme: ThemeMode) {
      this.theme = theme
      this.persist()
    },
    setDefaultDepth(depth: 1 | 2) {
      this.defaultDepth = depth
      this.persist()
    },
    setAutoUpdate(enabled: boolean) {
      this.autoUpdate = enabled
      this.persist()
    },
    setBetaUpdates(enabled: boolean) {
      this.betaUpdates = enabled
      this.persist()
    },
    /** `false` se vazia ou já existente (sem diferenciar maiúsculas). */
    addExclusion(path: string): boolean {
      const next = addPath(this.extraExclusions, path)
      if (!next) return false
      this.extraExclusions = next
      this.persist()
      return true
    },
    addProjectRoot(path: string): boolean {
      const next = addPath(this.projectRoots, path)
      if (!next) return false
      this.projectRoots = next
      this.persist()
      return true
    },
    removeProjectRoot(path: string) {
      this.projectRoots = this.projectRoots.filter((p) => p !== path)
      this.persist()
    },
    setMinIdleDays(days: MinIdleDays) {
      this.minIdleDays = days
      this.persist()
    },
    removeExclusion(path: string) {
      this.extraExclusions = this.extraExclusions.filter((p) => p !== path)
      this.persist()
    },
  },
})
