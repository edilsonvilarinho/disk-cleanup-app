import type { Settings, SettingsStorage } from '../application/settings'
import type { Theme } from '../application/theme'

const KEY = 'dc-settings'
const DARK_QUERY = '(prefers-color-scheme: dark)'

/** localStorage pode estar indisponível (modo privado, política): falha silenciosa. */
export const localStorageSettingsStorage: SettingsStorage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  save(settings: Settings) {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* preferências valem só nesta sessão */
    }
  },
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches
}

/** Chama `onChange` quando o sistema troca entre claro e escuro. */
export function watchSystemTheme(onChange: () => void): void {
  if (typeof matchMedia !== 'function') return
  matchMedia(DARK_QUERY).addEventListener?.('change', onChange)
}

export function applyThemeToDocument(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}
