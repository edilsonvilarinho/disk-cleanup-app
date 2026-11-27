// Gateway de demonstração: permite abrir a interface no navegador (`pnpm dev`)
// sem o núcleo Rust. Dados baseados no caso documentado na skill; mesmo
// contrato do núcleo (textos `{pt, en}`, motivos e erros como código).
import type { ClassifyRequest, DiskCleanupGateway, SurveyRequest } from '../application/gateway'
import { defaultDisposal } from '../domain/disposal'
import { GIB } from '../domain/format'
import type {
  ApprovalDto,
  CandidateDto,
  ClassificationDto,
  Disposal,
  DuplicatesDto,
  ErrorDto,
  RuleCheckDto,
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
  TreeNodeDto,
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

const node = (name: string, size: number, children: TreeNodeDto[] = []): TreeNodeDto => ({ name, bytes: gb(size), children })

/** Mapa do volume de exemplo (mesmos totais das raízes). */
const DEMO_TREE: TreeNodeDto = node('C:\\', 822.3, [
  node('Users', 412.6, [
    node('demo', 404, [
      node('AppData', 186.4, [node('Local', 151.2), node('Roaming', 35.2)]),
      node('OneDrive - Empresa', 9.1),
      node('workspace', 44.7, [node('api-pagamentos', 9.4), node('loja-vue', 6.1), node('', 29.2)]),
      node('Downloads', 38.5),
      node('.gradle', 14.2),
      node('', 111.1),
    ]),
    node('Public', 8.6),
  ]),
  node('Program Files', 158.3),
  node('ProgramData', 96.4),
  node('Program Files (x86)', 92.1),
  node('Windows', 38.9, [node('WinSxS', 14.8), node('System32', 12.1), node('', 12)]),
  node('pagefile.sys', 24),
])

const PROJECTS: CandidateDto[] = [
  project('api-pagamentos', 'target', 6.8, 203, text('cargo build recria', 'cargo build recreates it')),
  project('ml-notebook', '.venv', 3.4, 131, text('recriar o ambiente (pip/uv) antes de usar', 'recreate the environment (pip/uv) before use')),
  project('loja-vue', 'node_modules', 1.9, 412, text('npm/pnpm/yarn install recria', 'npm/pnpm/yarn install recreates it')),
  project('site-pessoal', 'node_modules', 0.6, 12, text('npm/pnpm/yarn install recria', 'npm/pnpm/yarn install recreates it')),
]

const DEMO_DUPLICATES = [
  {
    size: 5.8,
    keep: '%USERPROFILE%\\Downloads\\Win11_24H2_x64.iso',
    copies: ['D:\\isos\\Win11_24H2_x64.iso'],
  },
  {
    size: 1.7,
    keep: '%USERPROFILE%\\Desktop\\fotos-viagem-2024.zip',
    copies: ['%USERPROFILE%\\Documents\\fotos-viagem-2024.zip', '%USERPROFILE%\\Downloads\\fotos-viagem-2024 (1).zip'],
  },
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
  /** Regras próprias, projetos dos perfis ligados e duplicados, da última classificação. */
  private custom: CandidateDto[] = []
  private dups: typeof DEMO_DUPLICATES = []
  private runs: TierRunDto[] = []
  private free = INITIAL_FREE

  constructor(private readonly delayMs = 400) {}

  private wait() {
    return new Promise((resolve) => setTimeout(resolve, this.delayMs))
  }

  async systemInfo(): Promise<SystemInfoDto> {
    return {
      os: 'demo',
      volumeRoot: 'C:\\',
      profile: 'C:\\Users\\demo',
      catalog: 'windows',
      projectProfiles: [
        { id: 'node', label: text('Node.js') },
        { id: 'rust', label: text('Rust') },
        { id: 'python', label: text('Python') },
      ],
    }
  }

  /** Duplicados de exemplo; a próxima classificação inclui as cópias (exceto a mantida). */
  async findDuplicates(): Promise<DuplicatesDto> {
    await this.wait()
    this.dups = DEMO_DUPLICATES
    return {
      groups: DEMO_DUPLICATES.map((g) => ({ sizeBytes: gb(g.size), keep: g.keep, copies: g.copies })),
      stats: { files: 18_402, sameSize: 1_284, samePartial: 96, sameFull: 7, confirmed: 7 },
    }
  }

  /** Mesmos códigos do núcleo, com regras simplificadas para a demonstração. */
  async checkRule(extraExclusions: string[], path: string): Promise<RuleCheckDto> {
    const value = path.trim()
    if (!value) return { code: 'empty', detail: null, reason: null }
    const lower = value.toLowerCase()
    const hit = [...EXCLUSIONS.map((e) => e.pattern), ...extraExclusions].find((p) => {
      const pl = p.toLowerCase()
      return lower.startsWith(pl) || pl.startsWith(lower)
    })
    if (hit) return { code: 'excluded', detail: hit, reason: text('exclusão obrigatória', 'mandatory exclusion') }
    if (value.split(/[\\/]/).filter(Boolean).length < 3) return { code: 'too_broad', detail: value, reason: null }
    return { code: 'ok', detail: value, reason: null }
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
      tree: DEMO_TREE,
    }
  }

  async classify(request: ClassifyRequest): Promise<ClassificationDto> {
    await this.wait()
    this.extra = [...request.extraExclusions]
    const own = request.userRules.map((r) =>
      candidate(`user:${r.path}`, text(r.label || r.path), r.tier, 1.2, r.path, { note: text('regra própria', 'own rule') }),
    )
    const profileOf = (c: CandidateDto) => (c.target.endsWith('node_modules') ? 'node' : c.target.endsWith('target') ? 'rust' : 'python')
    const projects = PROJECTS.filter((c) => !request.disabledProfiles.includes(profileOf(c)))
    const dups = this.dups.flatMap((g) =>
      g.copies.map((copy) =>
        candidate(`dup:${copy}`, text(copy.split('\\').pop()!), 'D', g.size, copy, {
          origin: 'duplicate',
          risk: 'low',
          note: text(`cópia de ${g.keep}`, `copy of ${g.keep}`),
        }),
      ),
    )
    const orphans = request.findOrphans
      ? [
          candidate('orphan:%APPDATA%\\Postman', text('Postman'), 'D', 1.1, '%APPDATA%\\Postman', {
            origin: 'orphan',
            idleDays: 520,
            risk: 'low',
            note: text('nenhum programa instalado com este nome · sem modificação há 520 dias', 'no installed program with this name · not modified for 520 days'),
          }),
        ]
      : []
    this.custom = [...own, ...projects, ...dups, ...orphans]
    const extra = this.extra.map((pattern) => ({ pattern, reason: text('excluída nas Configurações', 'excluded in Settings') }))
    const isExcluded = (c: CandidateDto) => this.extra.some((p) => c.target.toLowerCase().startsWith(p.toLowerCase()))
    const candidates = [...CANDIDATES, ...this.custom, ...FILES].filter((c) => !isExcluded(c))
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
    const items = [...CANDIDATES, ...this.custom, ...FILES].filter((c) => selected.includes(c.id))
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
