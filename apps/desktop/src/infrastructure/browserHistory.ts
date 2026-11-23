import type { HistoryStorage } from '../application/history'

const KEY = 'dc-history'

/** Mesmo armazenamento das preferências (persistido pelo WebView entre sessões).
 *  Cota cheia ou storage bloqueado: `false`, e a tela avisa que não gravou. */
export const localStorageHistoryStorage: HistoryStorage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  save(snapshots) {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshots))
      return true
    } catch {
      return false
    }
  },
}
