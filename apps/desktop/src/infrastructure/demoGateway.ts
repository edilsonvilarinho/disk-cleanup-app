// Gateway de demonstração: permite abrir a interface no navegador (`pnpm dev`)
// sem o núcleo Rust. Dados baseados no caso documentado na skill; mesmo
// contrato do núcleo (textos `{pt, en}`, motivos e erros como código).
import type { DiskCleanupGateway, SurveyRequest } from '../application/gateway'
import { defaultDisposal } from '../domain/disposal'
import { GIB } from '../domain/format'
import type {
  ApprovalDto,
  CandidateDto,
  ClassificationDto,
  Disposal,
  ErrorDto,
  ExclusionDto,
  ExecutionEventDto,
  ItemResultDto,
  PlanDto,
  ReportDto,
  ScanProgressDto,
  StepDto,
  SurveyDto,
  SystemInfoDto,
  TextDto,
  Tier,
  TierRunDto,
  UsageEntryDto,
} from '../domain/models'
import { TIERS } from '../domain/selection'

const gb = (n: number) => Math.round(n * GIB)
const text = (pt: string, en = pt): TextDto => ({ pt, en })
const fail = (code: string, params: Record<string, string> = {}): ErrorDto => ({ code, params })

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
  label: TextDto,
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
  note: text(''),
  blocked: null,
  origin: 'rule',
  project: null,
  idleDays: null,
  ...extra,
})

/** Artefato de projeto de exemplo (tier C), com raiz e dias sem atividade. */
const project = (name: string, artifact: string, size: number, idleDays: number, note: TextDto): CandidateDto =>
  candidate(`project:D:\\dev\\${name}\\${artifact}`, text(`${name} · ${artifact}`), 'C', size, `D:\\dev\\${name}\\${artifact}`, {
    note,
    origin: 'project',
    project: `D:\\dev\\${name}`,
    idleDays,
  })

const PROJECTS: CandidateDto[] = [
  project('api-pagamentos', 'target', 6.8, 203, text('cargo build recria', 'cargo build recreates it')),
  project('ml-notebook', '.venv', 3.4, 131, text('recriar o ambiente (pip/uv) antes de usar', 'recreate the environment (pip/uv) before use')),
  project('loja-vue', 'node_modules', 1.9, 412, text('npm/pnpm/yarn install recria', 'npm/pnpm/yarn install recreates it')),
  project('site-pessoal', 'node_modules', 0.6, 12, text('npm/pnpm/yarn install recria', 'npm/pnpm/yarn install recreates it')),
]

/** Arquivo grande do perfil (tier D), nunca pré-marcado. */
const file = (path: string, size: number, idleDays: number): CandidateDto =>
  candidate(`file:${path}`, text(path.split('\\').pop()!), 'D', size, path, { origin: 'file', idleDays, risk: 'low' })

const FILES: CandidateDto[] = [
  file('%USERPROFILE%\\Downloads\\Win11_24H2_x64.iso', 5.8, 150),
  file('%USERPROFILE%\\Downloads\\ubuntu-22.04.4-desktop-amd64.iso', 4.9, 420),
  file('%USERPROFILE%\\Videos\\gravacao-reuniao-2025-03.mp4', 3.6, 240),
]

const CANDIDATES: CandidateDto[] = [
  candidate('npm-cache', text('npm cache'), 'A', 6.4, 'npm cache clean --force', {
    kind: 'command',
    note: text('comando oficial', 'official command'),
  }),
  candidate('pip-cache', text('pip cache'), 'A', 3.1, 'pip cache purge', { kind: 'command' }),
  candidate('nvidia-dxcache', text('NVIDIA DXCache'), 'A', 4.8, '%LOCALAPPDATA%\\NVIDIA\\DXCache', {
    note: text('arquivos abertos pelo driver podem ficar', 'files held by the driver may stay'),
  }),
  candidate('chrome-ondevice-model', text('Chrome — modelo on-device', 'Chrome — on-device model'), 'A', 3.9,
    '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\OptGuideOnDeviceModel'),
  candidate('windows-update-download', text('Windows Update — Download'), 'A', 5.3, 'C:\\Windows\\SoftwareDistribution\\Download', {
    note: text('requer administrador', 'requires administrator'),
  }),
  candidate('gradle-caches', text('Gradle caches'), 'C', 14.2, '%USERPROFILE%\\.gradle\\caches', {
    note: text("rodar 'gradle --stop' antes", "run 'gradle --stop' first"),
  }),
  candidate('maven-repository', text('Maven repository'), 'C', 6.8, '%USERPROFILE%\\.m2\\repository'),
  candidate('huggingface-cache', text('HuggingFace cache'), 'C', 5.5, '%USERPROFILE%\\.cache\\huggingface', {
    blocked: { code: 'env_var', value: 'HF_HOME' },
  }),
]

const EXCLUSIONS: ExclusionDto[] = [
  { pattern: 'C:\\Windows\\Installer', reason: text('cache do MSI; sem ele a desinstalação quebra', 'MSI cache; without it uninstalling breaks') },
  { pattern: 'C:\\Windows\\WinSxS', reason: text('só via DISM', 'only through DISM') },
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

const SCAN_STEPS = [90_000, 260_000, 330_000, 470_000, 640_000, 700_000, 820_000, 960_000, 1_030_000, 1_100_000]

export class DemoGateway implements DiskCleanupGateway {
  private planned: CandidateDto[] = []
  private extra: string[] = []
  private approved: Tier[] = []
  private disposals: Partial<Record<Tier, Disposal>> = {}
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
    // Passos irregulares: pastas de muitos arquivos pequenos e de poucos grandes,
    // para o ritmo (arquivos/s) da tela de varredura variar como numa varredura real.
    for (const files of SCAN_STEPS) {
      await this.wait()
      onProgress({ files, logicalBytes: gb(files / 1500) })
    }
    return {
      volume: volume(INITIAL_FREE),
      roots: [
        entry('Users', 412.6),
        entry('Program Files', 158.3),
        entry('ProgramData', 96.4),
        entry('Program Files (x86)', 92.1),
        entry('Windows', 38.9),
        entry('pagefile.sys', 24),
      ],
      children: [],
      profile: [entry('AppData', 186.4), entry('OneDrive - Empresa', 60, 9.1), entry('workspace', 44.7), entry('Downloads', 38.5), entry('.gradle', 14.2)],
      cloud: [entry('OneDrive - Empresa', 60, 9.1)],
      files: 1_100_000,
      unreadable: 37,
      unattributedBytes: gb(56.4),
      elapsedMs: this.delayMs * SCAN_STEPS.length,
    }
  }

  async classify(extraExclusions: string[], _projectRoots: string[]): Promise<ClassificationDto> {
    await this.wait()
    this.extra = [...extraExclusions]
    const extra = this.extra.map((pattern) => ({ pattern, reason: text('excluída nas Configurações', 'excluded in Settings') }))
    const isExcluded = (c: CandidateDto) => this.extra.some((p) => c.target.toLowerCase().startsWith(p.toLowerCase()))
    const candidates = [...CANDIDATES, ...PROJECTS, ...FILES].filter((c) => !isExcluded(c))
    return {
      candidates,
      skipped: [
        { id: 'yarn-cache', code: 'not_found', detail: '%LOCALAPPDATA%\\Yarn\\Cache', reason: null },
        ...CANDIDATES.filter(isExcluded).map((c) => ({ id: c.id, code: 'excluded' as const, detail: null, reason: extra[0]!.reason })),
      ],
      exclusions: [...EXCLUSIONS, ...extra],
      selectableBytes: candidates.filter((c) => !c.blocked).reduce((s, c) => s + c.sizeBytes, 0),
    }
  }

  async buildPlan(volumeName: string, selected: string[]): Promise<PlanDto> {
    const items = [...CANDIDATES, ...PROJECTS, ...FILES].filter((c) => selected.includes(c.id))
    if (items.length === 0) throw fail('plan_empty')
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
        volume: volumeName,
        tiers: Object.fromEntries(
          tiers.map((t) => [
            t.tier,
            items
              .filter((c) => c.tier === t.tier)
              .map((c) => ({ id: c.id, label: c.label.pt, kind: c.kind, target: c.target, estimatedBytes: c.sizeBytes })),
          ]),
        ),
      },
      null,
      2,
    )
    return { itemCount: items.length, estimatedBytes: items.reduce((s, c) => s + c.sizeBytes, 0), tiers, json }
  }

  async approvePlan(tiers: Tier[], disposals: Partial<Record<Tier, Disposal>>, acknowledged: boolean): Promise<ApprovalDto> {
    if (this.planned.length === 0) throw fail('plan_required')
    if (tiers.length === 0) throw fail('approval_no_tier')
    if (!acknowledged) throw fail('approval_not_acknowledged')
    this.approved = [...tiers]
    this.disposals = Object.fromEntries(tiers.map((t) => [t, disposals[t] ?? defaultDisposal(t)]))
    this.runs = []
    const items = this.planned.filter((c) => tiers.includes(c.tier))
    return { tiers, itemCount: items.length, estimatedBytes: items.reduce((s, c) => s + c.sizeBytes, 0), disposals: { ...this.disposals } }
  }

  /** Destino de um caminho no tier; comando não tem como ir para a Lixeira. */
  private disposalOf(c: CandidateDto): Disposal | null {
    return c.kind === 'path' ? (this.disposals[c.tier] ?? defaultDisposal(c.tier)) : null
  }

  private itemsOf(tier: Tier): CandidateDto[] {
    if (!this.approved.includes(tier)) throw fail('not_approved')
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
      disposal: this.disposalOf(c),
    }))
  }

  async executeTier(tier: Tier, onEvent: (event: ExecutionEventDto) => void): Promise<TierRunDto> {
    const items = this.itemsOf(tier)
    if (this.runs.some((r) => r.tier === tier)) throw fail('tier_already_run', { tier })
    const before = this.free
    const results: ItemResultDto[] = []
    for (const c of items) {
      onEvent({ kind: 'started', id: c.id, result: null })
      await this.wait()
      // DXCache: o driver segura parte dos arquivos, como no caso real da skill.
      const partial = c.id === 'nvidia-dxcache'
      const moved = partial ? Math.round(c.sizeBytes * 0.88) : c.sizeBytes
      // Ir para a Lixeira tira do lugar, mas não libera espaço no volume.
      const toTrash = this.disposalOf(c) === 'trash'
      const freed = toTrash ? 0 : moved
      this.free += freed
      const result: ItemResultDto = {
        id: c.id,
        label: c.label,
        tier,
        estimatedBytes: c.sizeBytes,
        freedBytes: freed,
        status: partial ? 'partial' : 'ok',
        cause: partial ? { code: 'partial_locked', detail: null, exitCode: null } : null,
        trashedBytes: toTrash ? moved : 0,
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
      trashedBytes: results.reduce((s, r) => s + r.trashedBytes, 0),
      items: results,
    }
    this.runs.push(run)
    return run
  }

  async report(): Promise<ReportDto> {
    if (this.runs.length === 0) throw fail('no_execution')
    return {
      initial: volume(INITIAL_FREE),
      last: volume(this.free),
      freedBytes: this.free - INITIAL_FREE,
      estimatedBytes: this.runs.reduce((s, r) => s + r.estimatedBytes, 0),
      trashedBytes: this.runs.reduce((s, r) => s + r.trashedBytes, 0),
      itemCount: this.runs.reduce((s, r) => s + r.items.length, 0),
      runs: this.runs,
      pending: this.runs.flatMap((r) => r.items.filter((i) => i.status === 'partial' || i.status === 'failed')),
      blocked: CANDIDATES.filter((c) => c.blocked !== null),
      exclusions: [...EXCLUSIONS, ...this.extra.map((pattern) => ({ pattern, reason: text('excluída nas Configurações', 'excluded in Settings') }))],
    }
  }
}
