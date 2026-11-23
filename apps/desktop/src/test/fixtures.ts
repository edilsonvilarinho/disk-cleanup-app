// Dados de teste: forma idêntica aos DTOs do núcleo Rust.
import { GIB } from '../domain/format'
import type { CandidateDto, ClassificationDto, PlanDto, SurveyDto, SystemInfoDto, UsageEntryDto } from '../domain/models'

export const systemInfo: SystemInfoDto = {
  os: 'windows',
  volumeRoot: 'C:\\',
  profile: 'C:\\Users\\u',
  catalog: 'windows',
}

const entry = (name: string, gb: number, cloud = false, realGb = gb): UsageEntryDto => ({
  key: [name],
  name,
  logicalBytes: gb * GIB,
  allocatedBytes: realGb * GIB,
  placeholderBytes: (gb - realGb) * GIB,
  files: 10,
  isCloud: cloud,
})

export const survey: SurveyDto = {
  volume: {
    totalBytes: 953 * GIB,
    freeBytes: 61.6 * GIB,
    usedBytes: 891.4 * GIB,
    usedPercent: 93.5,
    freePercent: 6.5,
    health: 'critical',
  },
  roots: [entry('Users', 412.6), entry('Windows', 38.9)],
  children: [{ ...entry('u', 300), key: ['Users', 'u'] }],
  profile: [entry('AppData', 186.4), entry('OneDrive - Empresa', 60, true, 9.1)],
  cloud: [entry('OneDrive - Empresa', 60, true, 9.1)],
  files: 1_284_316,
  unreadable: 12,
  unattributedBytes: 56.4 * GIB,
  elapsedMs: 222_000,
}

export const candidate = (
  id: string,
  tier: CandidateDto['tier'],
  gb: number,
  extra: Partial<CandidateDto> = {},
): CandidateDto => ({
  id,
  label: `Rótulo ${id}`,
  tier,
  kind: 'path',
  target: `C:\\x\\${id}`,
  sizeBytes: gb * GIB,
  risk: 'none',
  note: '',
  blockedReason: null,
  ...extra,
})

export const classification: ClassificationDto = {
  candidates: [
    candidate('npm-cache', 'A', 6.4, { kind: 'command', target: 'npm cache clean --force', note: 'comando oficial' }),
    candidate('nvidia-dxcache', 'A', 4.8),
    candidate('gradle-caches', 'C', 14.2, { risk: 'redownload' }),
    candidate('cuda', 'C', 2.64, { blockedReason: 'variável CUDA_PATH aponta para este caminho' }),
  ],
  skipped: [{ id: 'yarn-cache', reason: 'caminho não existe: C:\\Yarn' }],
  exclusions: [{ pattern: 'C:\\Windows\\Installer', reason: 'cache do MSI' }],
  selectableBytes: 25.4 * GIB,
}

export const plan: PlanDto = {
  itemCount: 3,
  estimatedBytes: 25.4 * GIB,
  tiers: [
    { tier: 'A', itemCount: 2, estimatedBytes: 11.2 * GIB },
    { tier: 'C', itemCount: 1, estimatedBytes: 14.2 * GIB },
  ],
  json: '{\n  "volume": "C:",\n  "tiers": {}\n}',
}
