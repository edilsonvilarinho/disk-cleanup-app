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

/** Último ponto clicado: a troca de tema se revela em círculo a partir dele. */
let origin: { x: number; y: number } | null = null

export function trackPointer(target: Pick<Window, 'addEventListener'> = window): void {
  target.addEventListener('pointerdown', (event) => {
    const e = event as PointerEvent
    origin = { x: e.clientX, y: e.clientY }
  }, { capture: true })
}

type WithViewTransition = Document & { startViewTransition?: (update: () => void) => unknown }

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Aplica o tema. Numa troca (não na abertura), revela o novo tema em círculo a
 *  partir do último clique, via View Transitions; sem suporte ou com movimento
 *  reduzido, troca na hora. */
export function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement
  const set = () => root.setAttribute('data-theme', theme)
  const previous = root.getAttribute('data-theme')
  const doc = document as WithViewTransition
  if (!previous || previous === theme || typeof doc.startViewTransition !== 'function' || reducedMotion()) return set()
  const x = origin?.x ?? innerWidth / 2
  const y = origin?.y ?? innerHeight / 2
  root.style.setProperty('--vt-x', `${x}px`)
  root.style.setProperty('--vt-y', `${y}px`)
  root.style.setProperty('--vt-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`)
  doc.startViewTransition(set)
}
