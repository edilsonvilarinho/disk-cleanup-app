import type { Theme, ThemeStorage } from '../application/theme'

const KEY = 'dc-theme'

/** localStorage pode estar indisponível (modo privado, política): falha silenciosa. */
export const localStorageThemeStorage: ThemeStorage = {
  get() {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(value) {
    try {
      localStorage.setItem(KEY, value)
    } catch {
      /* preferência vale só nesta sessão */
    }
  },
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyThemeToDocument(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}
