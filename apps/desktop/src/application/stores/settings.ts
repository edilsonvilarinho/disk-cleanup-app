import { defineStore } from 'pinia'
import type { LanguagePreference } from '../../i18n/i18n'
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings, type ThemeMode } from '../settings'

export const useSettingsStore = defineStore('settings', {
  state: (): Settings => ({ ...DEFAULT_SETTINGS, extraExclusions: [] }),
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
    /** `false` se vazia ou já existente (sem diferenciar maiúsculas). */
    addExclusion(path: string): boolean {
      const value = path.trim()
      if (!value || this.extraExclusions.some((p) => p.toLowerCase() === value.toLowerCase())) return false
      this.extraExclusions.push(value)
      this.persist()
      return true
    },
    removeExclusion(path: string) {
      this.extraExclusions = this.extraExclusions.filter((p) => p !== path)
      this.persist()
    },
  },
})
