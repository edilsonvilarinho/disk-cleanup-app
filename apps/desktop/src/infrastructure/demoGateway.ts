// Gateway de demonstração: permite abrir a interface no navegador (`pnpm dev`)
// sem o núcleo Rust. Dados baseados no caso documentado na skill.
import type { DiskCleanupGateway, SurveyRequest } from '../application/gateway'
import { GIB } from '../domain/format'
import type {
  ApprovalDto,
  CandidateDto,
  ExecutionEventDto,
  ItemResultDto,
  ReportDto,
  StepDto,
  TierRunDto,
  ClassificationDto,
  PlanDto,
  ScanProgressDto,
  SurveyDto,
  SystemInfoDto,
  Tier,
  UsageEntryDto,
} from '../domain/models'
import { TIERS } from '../domain/selection'

const gb = (n: number) => Math.round(n * GIB)

const entry = (name: string, logical: number, real = logical, key = [name]): UsageEntryDto => ({
  key,
  name,
  logicalBytes: gb(logical),
  allocatedBytes: gb(real),
  placeholderBytes: gb(logical - real),
  files: 0,
  isCloud: real !== logical,
})

const candidate = (
  id: string,
  label: string,
  tier: Tier,
  size: number,
  target: string,
  extra: Partial<CandidateDto> = {},
): CandidateDto => ({
  id,
  label,
  tier,
  kind: 'path',
  target,
  sizeBytes: gb(size),
  risk: tier === 'C' ? 'redownload' : 'none',
  note: '',
  blockedReason: null,
  ...extra,
})

const CANDIDATES: CandidateDto[] = [
  candidate('npm-cache', 'npm cache', 'A', 6.4, 'npm cache clean --force', { kind: 'command', note: 'comando oficial' }),
  candidate('pip-cache', 'pip cache', 'A', 3.1, 'pip cache purge', { kind: 'command' }),
  candidate('nvidia-dxcache', 'NVIDIA DXCache', 'A', 4.8, '%LOCALAPPDATA%\\NVIDIA\\DXCache', {
    note: 'arquivos abertos pelo driver podem ficar',
  }),
  candidate('chrome-ondevice-model', 'Chrome — modelo on-device', 'A', 3.9, '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\OptGuideOnDeviceModel'),
  candidate('windows-update-download', 'Windows Update — Download', 'A', 5.3, 'C:\\Windows\\SoftwareDistribution\\Download', {
    note: 'requer administrador',
  }),
  candidate('gradle-caches', 'Gradle caches', 'C', 14.2, '%USERPROFILE%\\.gradle\\caches', { note: "rodar 'gradle --stop' antes" }),
  candidate('maven-repository', 'Maven repository', 'C', 6.8, '%USERPROFILE%\\.m2\\repository'),
  candidate('huggingface-cache', 'HuggingFace cache', 'C', 5.5, '%USERPROFILE%\\.cache\\huggingface', {
    blockedReason: 'variável HF_HOME aponta para este caminho',
  }),
]

const TOTAL = gb(953)
const INITIAL_FREE = gb(61.6)

function volume(free: number) {
  return {
    totalBytes: TOTAL,
    freeBytes: free,
    usedBytes: TOTAL - free,
    usedPercent: ((TOTAL - free) / TOTAL) * 100,
    freePercent: (free / TOTAL) * 100,
    health: free / TOTAL < 0.1 ? ('critical' as const) : free / TOTAL < 0.2 ? ('warning' as const) : ('healthy' as const),
  }
}

export class DemoGateway implements DiskCleanupGateway {
  private planned: CandidateDto[] = []
  private approved: Tier[] = []
  private runs: TierRunDto[] = []
  private free = INITIAL_FREE

  constructor(private readonly delayMs = 400) {}

  private wait() {
    return new Promise((resolve) => setTimeout(resolve, this.delayMs))
  }

  async systemInfo(): Promise<SystemInfoDto> {
    return { os: 'demo', volumeRoot: 'C:\\', profile: 'C:\\Users\\demo', catalog: 'windows' }
  }

  async runSurvey(_request: SurveyRequest, onProgress: (p: ScanProgressDto) => void): Promise<SurveyDto> {
    for (const files of [250_000, 640_000, 1_100_000]) {
      await this.wait()
      onProgress({ files, logicalBytes: gb(files / 1500) })
    }
    const total = gb(953)
    const free = gb(61.6)
    return {
      volume: {
        totalBytes: total,
        freeBytes: free,
        usedBytes: total - free,
        usedPercent: ((total - free) / total) * 100,
        freePercent: (free / total) * 100,
        health: 'critical',
      },
      roots: [
        entry('Users', 412.6),
        entry('Program Files', 158.3),
        entry('ProgramData', 96.4),
        entry('Program Files (x86)', 92.1),
        entry('Windows', 38.9),
        entry('pagefile.sys', 24),
      ],
      children: [],
      profile: [
        entry('AppData', 186.4),
        entry('OneDrive - Empresa', 60, 9.1),
        entry('workspace', 44.7),
        entry('Downloads', 38.5),
        entry('.gradle', 14.2),
      ],
      cloud: [entry('OneDrive - Empresa', 60, 9.1)],
      files: 1_100_000,
      unreadable: 37,
      unattributedBytes: gb(56.4),
      elapsedMs: this.delayMs * 3,
    }
  }

  async classify(): Promise<ClassificationDto> {
    await this.wait()
    return {
      candidates: CANDIDATES,
      skipped: [{ id: 'yarn-cache', reason: 'caminho não existe: %LOCALAPPDATA%\\Yarn\\Cache' }],
      exclusions: [
        { pattern: 'C:\\Windows\\Installer', reason: 'cache do MSI; sem ele a desinstalação quebra' },
        { pattern: 'C:\\Windows\\WinSxS', reason: 'só via DISM' },
      ],
      selectableBytes: CANDIDATES.filter((c) => !c.blockedReason).reduce((s, c) => s + c.sizeBytes, 0),
    }
  }

  async buildPlan(volume: string, selected: string[]): Promise<PlanDto> {
    const items = CANDIDATES.filter((c) => selected.includes(c.id))
    if (items.length === 0) throw new Error('nenhum item selecionado')
    this.planned = items
    this.approved = []
    this.runs = []
    this.free = INITIAL_FREE
    const tiers = TIERS.map((tier) => {
      const inTier = items.filter((c) => c.tier === tier)
      return { tier, itemCount: inTier.length, estimatedBytes: inTier.reduce((s, c) => s + c.sizeBytes, 0) }
    }).filter((t) => t.itemCount > 0)
    const json = JSON.stringify(
      {
        volume,
        tiers: Object.fromEntries(
          tiers.map((t) => [
            t.tier,
            items
              .filter((c) => c.tier === t.tier)
              .map((c) => ({ id: c.id, label: c.label, kind: c.kind, target: c.target, estimatedBytes: c.sizeBytes })),
          ]),
        ),
      },
      null,
      2,
    )
    return { itemCount: items.length, estimatedBytes: items.reduce((s, c) => s + c.sizeBytes, 0), tiers, json }
  }

  async approvePlan(tiers: Tier[], acknowledged: boolean): Promise<ApprovalDto> {
    if (!acknowledged) throw new Error('revisão do plano não confirmada')
    if (this.planned.length === 0) throw new Error('monte o plano antes de aprovar')
    if (tiers.length === 0) throw new Error('nenhum tier aprovado')
    this.approved = [...tiers]
    this.runs = []
    const items = this.planned.filter((c) => tiers.includes(c.tier))
    return { tiers, itemCount: items.length, estimatedBytes: items.reduce((s, c) => s + c.sizeBytes, 0) }
  }

  private itemsOf(tier: Tier): CandidateDto[] {
    if (!this.approved.includes(tier)) throw new Error('nenhum plano aprovado para este tier')
    return this.planned.filter((c) => c.tier === tier)
  }

  async previewTier(tier: Tier): Promise<StepDto[]> {
    return this.itemsOf(tier).map((c) => ({
      id: c.id,
      label: c.label,
      tier,
      kind: c.kind,
      target: c.target,
      estimatedBytes: c.sizeBytes,
    }))
  }

  async executeTier(tier: Tier, onEvent: (event: ExecutionEventDto) => void): Promise<TierRunDto> {
    const items = this.itemsOf(tier)
    if (this.runs.some((r) => r.tier === tier)) throw new Error(`tier ${tier} já executado nesta aprovação`)
    const before = this.free
    const results: ItemResultDto[] = []
    for (const c of items) {
      onEvent({ kind: 'started', id: c.id, result: null })
      await this.wait()
      // DXCache: o driver segura parte dos arquivos, como no caso real da skill.
      const partial = c.id === 'nvidia-dxcache'
      const freed = partial ? Math.round(c.sizeBytes * 0.88) : c.sizeBytes
      this.free += freed
      const result: ItemResultDto = {
        id: c.id,
        label: c.label,
        tier,
        estimatedBytes: c.sizeBytes,
        freedBytes: freed,
        status: partial ? 'parcial' : 'ok',
        detail: partial ? 'arquivos abertos pelo driver' : null,
      }
      results.push(result)
      onEvent({ kind: 'finished', id: c.id, result })
    }
    const run: TierRunDto = {
      tier,
      freeBeforeBytes: before,
      freeAfterBytes: this.free,
      freedBytes: this.free - before,
      estimatedBytes: items.reduce((s, c) => s + c.sizeBytes, 0),
      items: results,
    }
    this.runs.push(run)
    return run
  }

  async report(): Promise<ReportDto> {
    if (this.runs.length === 0) throw new Error('nenhuma execução nesta sessão')
    const classification = await this.classify()
    return {
      initial: volume(INITIAL_FREE),
      last: volume(this.free),
      freedBytes: this.free - INITIAL_FREE,
      estimatedBytes: this.runs.reduce((s, r) => s + r.estimatedBytes, 0),
      itemCount: this.runs.reduce((s, r) => s + r.items.length, 0),
      runs: this.runs,
      pending: this.runs.flatMap((r) => r.items.filter((i) => i.status === 'parcial' || i.status === 'erro')),
      blocked: classification.candidates.filter((c) => c.blockedReason !== null),
      exclusions: classification.exclusions,
    }
  }
}
