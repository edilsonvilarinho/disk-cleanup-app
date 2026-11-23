import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { UpdaterPort } from '../application/updater'
import type { UpdateInfo, UpdateProgress } from '../domain/models'

const UPDATE_EVENT = 'update-progress'

/** Adaptador IPC para os comandos de atualização de `src-tauri/src/bootstrap.rs`. */
export class TauriUpdater implements UpdaterPort {
  constructor(
    private readonly call: typeof invoke = invoke,
    private readonly subscribe: typeof listen = listen,
  ) {}

  appVersion(): Promise<string> {
    return this.call<string>('app_version')
  }

  check(beta: boolean): Promise<UpdateInfo | null> {
    return this.call<UpdateInfo | null>('check_update', { beta })
  }

  async download(onProgress: (progress: UpdateProgress) => void): Promise<void> {
    const unlisten = await this.subscribe<UpdateProgress>(UPDATE_EVENT, (event) => onProgress(event.payload))
    try {
      await this.call<void>('download_update')
    } finally {
      unlisten()
    }
  }

  install(): Promise<void> {
    return this.call<void>('install_update')
  }
}

/** Fora do Tauri (navegador, `pnpm dev`, gravação dos GIFs): nunca há atualização. */
export class DemoUpdater implements UpdaterPort {
  async appVersion(): Promise<string> {
    return '0.0.0-demo'
  }

  async check(_beta: boolean): Promise<UpdateInfo | null> {
    return null
  }

  async download(_onProgress: (progress: UpdateProgress) => void): Promise<void> {
    throw { code: 'update_none', params: {} }
  }

  async install(): Promise<void> {
    throw { code: 'update_not_downloaded', params: {} }
  }
}
