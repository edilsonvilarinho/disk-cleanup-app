import { vi } from 'vitest'
import type { BackgroundPort } from '../application/background'
import { survey } from './fixtures'

/** Segundo plano falso: volume da fixture, avisos e bandeja registrados. */
export function fakeBackground(overrides: Partial<BackgroundPort> = {}): BackgroundPort & { trayScan: () => void } {
  let onScan: () => void = () => {}
  return {
    volumeUsage: vi.fn(async () => survey.volume),
    notify: vi.fn(async () => {}),
    setBackground: vi.fn(async () => {}),
    onTrayScan: vi.fn(async (callback: () => void) => {
      onScan = callback
      return () => {}
    }),
    trayScan: () => onScan(),
    ...overrides,
  }
}
