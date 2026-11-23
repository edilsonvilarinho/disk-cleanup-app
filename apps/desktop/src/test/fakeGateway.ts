import { vi } from 'vitest'
import type { DiskCleanupGateway } from '../application/gateway'
import { classification, plan, survey, systemInfo } from './fixtures'

/** Gateway falso com respostas padrão; cada método é um `vi.fn` substituível. */
export function fakeGateway(overrides: Partial<DiskCleanupGateway> = {}): DiskCleanupGateway {
  return {
    systemInfo: vi.fn(async () => systemInfo),
    runSurvey: vi.fn(async (_request, onProgress) => {
      onProgress({ files: 10_000, logicalBytes: 1024 })
      return survey
    }),
    classify: vi.fn(async () => classification),
    buildPlan: vi.fn(async () => plan),
    ...overrides,
  }
}
