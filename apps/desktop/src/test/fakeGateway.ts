import { vi } from 'vitest'
import type { DiskCleanupGateway } from '../application/gateway'
import { approval, classification, plan, report, runA, runC, stepsA, survey, systemInfo } from './fixtures'

/** Gateway falso com respostas padrão; cada método é um `vi.fn` substituível. */
export function fakeGateway(overrides: Partial<DiskCleanupGateway> = {}): DiskCleanupGateway {
  return {
    systemInfo: vi.fn(async () => systemInfo),
    runSurvey: vi.fn(async (_request, onProgress) => {
      onProgress({ files: 10_000, logicalBytes: 1024 })
      return survey
    }),
    classify: vi.fn(async () => classification),
    findDuplicates: vi.fn(async () => ({
      groups: [{ sizeBytes: 2 * 1024 ** 3, keep: 'C:\\Users\\u\\a.zip', copies: ['C:\\Users\\u\\b.zip'] }],
      stats: { files: 10, sameSize: 4, samePartial: 3, sameFull: 2, confirmed: 2 },
    })),
    checkRule: vi.fn(async (_extra: string[], path: string) => ({ code: 'ok' as const, detail: path, reason: null })),
    buildPlan: vi.fn(async () => plan),
    approvePlan: vi.fn(async () => approval),
    previewTier: vi.fn(async () => stepsA),
    executeTier: vi.fn(async (tier, onEvent) => {
      const run = tier === 'A' ? runA : runC
      for (const item of run.items) {
        onEvent({ kind: 'started', id: item.id, result: null })
        onEvent({ kind: 'finished', id: item.id, result: item })
      }
      return run
    }),
    report: vi.fn(async () => report),
    ...overrides,
  }
}
