// Dados de teste: forma idêntica aos DTOs do núcleo Rust.
import { GIB } from '../domain/format'
import type {
  ApprovalDto,
  CandidateDto,
  ClassificationDto,
  ItemResultDto,
  PlanDto,
  ReportDto,
  StepDto,
  SurveyDto,
  SystemInfoDto,
  TextDto,
  TierRunDto,
  UsageEntryDto,
} from '../domain/models'

const text = (pt: string, en = pt): TextDto => ({ pt, en })

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
  label: text(`Rótulo ${id}`, `Label ${id}`),
  tier,
  kind: 'path',
  target: `C:\\x\\${id}`,
  sizeBytes: gb * GIB,
  risk: 'none',
  note: text(''),
  blocked: null,
  ...extra,
})

export const classification: ClassificationDto = {
  candidates: [
    candidate('npm-cache', 'A', 6.4, { kind: 'command', target: 'npm cache clean --force', note: text('comando oficial', 'official command') }),
    candidate('nvidia-dxcache', 'A', 4.8),
    candidate('gradle-caches', 'C', 14.2, { risk: 'redownload' }),
    candidate('cuda', 'C', 2.64, { blocked: { code: 'env_var', value: 'CUDA_PATH' } }),
  ],
  skipped: [
    { id: 'yarn-cache', code: 'not_found', detail: 'C:\\Yarn', reason: null },
    { id: 'meu-projeto', code: 'excluded', detail: null, reason: text('excluída nas Configurações', 'excluded in Settings') },
  ],
  exclusions: [{ pattern: 'C:\\Windows\\Installer', reason: text('cache do MSI', 'MSI cache') }],
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

export const approval: ApprovalDto = { tiers: ['A', 'C'], itemCount: 3, estimatedBytes: 25.4 * GIB }

export const stepsA: StepDto[] = [
  { id: 'npm-cache', label: text('Rótulo npm-cache', 'Label npm-cache'), tier: 'A', kind: 'command', target: 'npm cache clean --force', estimatedBytes: 6.4 * GIB },
  { id: 'nvidia-dxcache', label: text('Rótulo nvidia-dxcache', 'Label nvidia-dxcache'), tier: 'A', kind: 'path', target: 'C:\\x\\nvidia-dxcache', estimatedBytes: 4.8 * GIB },
]

const result = (id: string, tier: ItemResultDto['tier'], gb: number, freedGb: number, extra: Partial<ItemResultDto> = {}): ItemResultDto => ({
  id,
  label: text(`Rótulo ${id}`, `Label ${id}`),
  tier,
  estimatedBytes: gb * GIB,
  freedBytes: freedGb * GIB,
  status: 'ok',
  cause: null,
  ...extra,
})

export const runA: TierRunDto = {
  tier: 'A',
  freeBeforeBytes: 61.6 * GIB,
  freeAfterBytes: 72.2 * GIB,
  freedBytes: 10.6 * GIB,
  estimatedBytes: 11.2 * GIB,
  items: [
    result('npm-cache', 'A', 6.4, 6.4),
    result('nvidia-dxcache', 'A', 4.8, 4.2, { status: 'partial', cause: { code: 'partial_os', detail: 'dx.bin: em uso', exitCode: null } }),
  ],
}

export const runC: TierRunDto = {
  tier: 'C',
  freeBeforeBytes: 72.2 * GIB,
  freeAfterBytes: 86.4 * GIB,
  freedBytes: 14.2 * GIB,
  estimatedBytes: 14.2 * GIB,
  items: [result('gradle-caches', 'C', 14.2, 14.2)],
}

export const report: ReportDto = {
  initial: survey.volume,
  last: { ...survey.volume, freeBytes: 86.4 * GIB, usedBytes: 866.6 * GIB, usedPercent: 90.9, freePercent: 9.1 },
  freedBytes: 24.8 * GIB,
  estimatedBytes: 25.4 * GIB,
  itemCount: 3,
  runs: [runA, runC],
  pending: [runA.items[1]!],
  blocked: [classification.candidates[3]!],
  exclusions: classification.exclusions,
}
