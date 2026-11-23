import { markRaw } from 'vue'
import type { PiniaPlugin } from 'pinia'
import type { UpdateInfo, UpdateProgress } from '../domain/models'

/** Porta do atualizador (separada do gateway de limpeza: interfaces segregadas). */
export interface UpdaterPort {
  appVersion(): Promise<string>
  /** `null` quando a versão instalada já é a mais recente do canal. */
  check(beta: boolean): Promise<UpdateInfo | null>
  download(onProgress: (progress: UpdateProgress) => void): Promise<void>
  /** Instala o que foi baixado e reinicia o app. */
  install(): Promise<void>
}

declare module 'pinia' {
  export interface PiniaCustomProperties {
    updater: UpdaterPort
  }
}

export function updaterPlugin(updater: UpdaterPort): PiniaPlugin {
  const raw = markRaw(updater)
  return () => ({ updater: raw })
}
