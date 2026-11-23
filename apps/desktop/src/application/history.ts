import { markRaw } from 'vue'
import type { PiniaPlugin } from 'pinia'
import type { ScanSnapshot } from '../domain/history'

/** Porta de persistência do histórico. `save` devolve `false` se não conseguiu gravar. */
export interface HistoryStorage {
  load(): unknown
  save(snapshots: ScanSnapshot[]): boolean
}

declare module 'pinia' {
  export interface PiniaCustomProperties {
    historyStorage: HistoryStorage
  }
}

export function historyPlugin(storage: HistoryStorage): PiniaPlugin {
  const raw = markRaw(storage)
  return () => ({ historyStorage: raw })
}

/** Armazenamento em memória: testes e ambientes sem persistência. */
export function memoryHistoryStorage(initial: unknown = null): HistoryStorage & { saved: ScanSnapshot[][] } {
  let current = initial
  const saved: ScanSnapshot[][] = []
  return {
    saved,
    load: () => current,
    save(snapshots) {
      current = structuredClone(snapshots)
      saved.push(structuredClone(snapshots))
      return true
    },
  }
}
