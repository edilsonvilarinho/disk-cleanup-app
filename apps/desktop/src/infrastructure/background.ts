import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen as tauriListen } from '@tauri-apps/api/event'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import type { BackgroundPort, TrayLabels } from '../application/background'
import type { VolumeDto } from '../domain/models'

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
type Listen = (event: string, handler: () => void) => Promise<() => void>

/** Notificação do sistema; permissão pedida só na primeira vez que precisa. */
export interface Notifier {
  granted(): Promise<boolean>
  request(): Promise<string>
  send(options: { title: string; body: string }): void
}

const tauriNotifier: Notifier = {
  granted: isPermissionGranted,
  request: requestPermission,
  send: sendNotification,
}

export class TauriBackground implements BackgroundPort {
  constructor(
    private readonly invoke: Invoke = tauriInvoke as Invoke,
    private readonly listen: Listen = tauriListen as unknown as Listen,
    private readonly notifier: Notifier = tauriNotifier,
  ) {}

  volumeUsage(volumeRoot: string): Promise<VolumeDto> {
    return this.invoke<VolumeDto>('volume_usage', { volumeRoot })
  }

  async notify(title: string, body: string): Promise<void> {
    const allowed = (await this.notifier.granted()) || (await this.notifier.request()) === 'granted'
    if (allowed) this.notifier.send({ title, body })
  }

  setBackground(enabled: boolean, labels: TrayLabels): Promise<void> {
    return this.invoke<void>('set_background', { enabled, labels })
  }

  onTrayScan(callback: () => void): Promise<() => void> {
    return this.listen('tray-scan', callback)
  }
}

/** Navegador (`pnpm dev`): sem bandeja nem aviso do sistema; volume de exemplo. */
export class BrowserBackground implements BackgroundPort {
  async volumeUsage(): Promise<VolumeDto> {
    const total = 953 * 1024 ** 3
    const free = 61.6 * 1024 ** 3
    return { totalBytes: total, freeBytes: free, usedBytes: total - free, usedPercent: 93.5, freePercent: 6.5, health: 'critical' }
  }

  async notify(): Promise<void> {}

  async setBackground(): Promise<void> {}

  async onTrayScan(): Promise<() => void> {
    return () => {}
  }
}
