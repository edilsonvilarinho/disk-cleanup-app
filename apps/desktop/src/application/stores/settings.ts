import { defineStore } from 'pinia'
import type { LanguagePreference } from '../../i18n/i18n'
import type { UserRule } from '../../domain/models'
import type { ClassifyRequest } from '../gateway'
import { DEFAULT_SETTINGS, sanitizeSettings, type MinIdleDays, type Settings, type ThemeMode } from '../settings'

/** Acrescenta caminho aparado; `null` se vazio ou já existente (sem diferenciar maiúsculas). */
function addPath(list: readonly string[], path: string): string[] | null {
  const value = path.trim()
  if (!value || list.some((p) => p.toLowerCase() === value.toLowerCase())) return null
  return [...list, value]
}

export const useSettingsStore = defineStore('settings', {
  state: (): Settings => ({ ...DEFAULT_SETTINGS, extraExclusions: [], projectRoots: [], userRules: [], disabledProfiles: [] }),
  getters: {
    /** O que a classificação recebe destas Configurações. */
    classifyRequest(): ClassifyRequest {
      return {
        extraExclusions: [...this.extraExclusions],
        projectRoots: [...this.projectRoots],
        userRules: this.userRules.map((r) => ({ ...r })),
        disabledProfiles: [...this.disabledProfiles],
        findOrphans: this.findOrphans,
      }
    },
  },
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
        userRules: this.userRules.map((r) => ({ ...r })),
        disabledProfiles: [...this.disabledProfiles],
        findOrphans: this.findOrphans,
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
    /** `false` se a pasta já tem regra (sem diferenciar maiúsculas). */
    addUserRule(rule: UserRule): boolean {
      const path = rule.path.trim()
      if (!path || this.userRules.some((r) => r.path.toLowerCase() === path.toLowerCase())) return false
      this.userRules = [...this.userRules, { label: rule.label.trim(), path, tier: rule.tier }]
      this.persist()
      return true
    },
    removeUserRule(path: string) {
      this.userRules = this.userRules.filter((r) => r.path !== path)
      this.persist()
    },
    setFindOrphans(enabled: boolean) {
      this.findOrphans = enabled
      this.persist()
    },
    toggleProfile(id: string) {
      this.disabledProfiles = this.disabledProfiles.includes(id)
        ? this.disabledProfiles.filter((p) => p !== id)
        : [...this.disabledProfiles, id]
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
