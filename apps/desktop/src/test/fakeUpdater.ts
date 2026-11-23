import { vi } from 'vitest'
import type { UpdaterPort } from '../application/updater'
import type { UpdateInfo } from '../domain/models'

export const updateInfo: UpdateInfo = { version: '0.2.0', currentVersion: '0.1.0', notes: '## Changes', date: null }

/** Updater falso: sem atualização por padrão; cada método é um `vi.fn` substituível. */
export function fakeUpdater(overrides: Partial<UpdaterPort> = {}): UpdaterPort {
  return {
    appVersion: vi.fn(async () => '0.1.0'),
    check: vi.fn(async () => null),
    download: vi.fn(async (onProgress) => {
      onProgress({ downloaded: 50, total: 100, percent: 50 })
      onProgress({ downloaded: 100, total: 100, percent: 100 })
    }),
    install: vi.fn(async () => {}),
    ...overrides,
  }
}
