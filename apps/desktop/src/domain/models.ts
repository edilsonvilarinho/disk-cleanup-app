// Contratos com o núcleo Rust (DTOs camelCase de src-tauri/src/dto.rs).
// Textos vêm em `{pt, en}`; motivos vêm como código + detalhe, traduzidos na UI.

export type Tier = 'A' | 'B' | 'C' | 'D'
export type Risk = 'none' | 'low' | 'redownload' | 'long-running'
export type Health = 'healthy' | 'warning' | 'critical'
export type ActionKind = 'path' | 'command' | 'uninstall'

export interface TextDto {
  pt: string
  en: string
}

export interface ErrorDto {
  code: string
  params: Record<string, string>
}

export interface SystemInfoDto {
  os: string
  volumeRoot: string
  profile: string | null
  catalog: string
  /** Perfis de projeto do catálogo (ligar/desligar nas Configurações). */
  projectProfiles: { id: string; label: TextDto }[]
}

/** Regra própria das Configurações: só pasta, tier A ou C. */
export interface UserRule {
  label: string
  path: string
  tier: 'A' | 'C'
}

export type RuleCheckCode = 'ok' | 'empty' | 'unresolved_variable' | 'excluded' | 'protected' | 'too_broad'

/** Validação de uma pasta de regra própria, feita pelo núcleo. */
export interface RuleCheckDto {
  code: RuleCheckCode
  detail: string | null
  reason: TextDto | null
}

export interface VolumeDto {
  totalBytes: number
  freeBytes: number
  usedBytes: number
  usedPercent: number
  freePercent: number
  health: Health
}

export interface UsageEntryDto {
  key: string[]
  name: string
  logicalBytes: number
  allocatedBytes: number
  placeholderBytes: number
  files: number
  isCloud: boolean
}

export interface SurveyDto {
  volume: VolumeDto
  roots: UsageEntryDto[]
  children: UsageEntryDto[]
  profile: UsageEntryDto[]
  cloud: UsageEntryDto[]
  files: number
  unreadable: number
  unattributedBytes: number
  elapsedMs: number
  /** Mapa do volume por espaço alocado; `name` vazio = "outros". */
  tree: TreeNodeDto
}

export interface TreeNodeDto {
  name: string
  bytes: number
  children: TreeNodeDto[]
}

export interface ScanProgressDto {
  files: number
  logicalBytes: number
}

export interface BlockDto {
  code: 'env_var' | 'path_entry'
  value: string
}

export interface CandidateDto {
  id: string
  label: TextDto
  tier: Tier
  kind: ActionKind
  target: string
  sizeBytes: number
  risk: Risk
  note: TextDto
  blocked: BlockDto | null
  /** `rule` (catálogo) | `project` (artefato de projeto) | `file` (arquivo grande do perfil). */
  origin: CandidateOrigin
  /** Raiz do projeto, quando o candidato é artefato de projeto. */
  project: string | null
  /** Dias sem atividade no projeto, ou desde a modificação do arquivo grande; `null` = desconhecido. */
  idleDays: number | null
}

export type CandidateOrigin = 'rule' | 'project' | 'file'

export type SkipCode = 'not_found' | 'empty' | 'unresolved_variable' | 'excluded' | 'unmeasurable'

export interface SkippedDto {
  id: string
  code: SkipCode
  detail: string | null
  reason: TextDto | null
}

export interface ExclusionDto {
  pattern: string
  reason: TextDto
}

export interface ClassificationDto {
  candidates: CandidateDto[]
  skipped: SkippedDto[]
  exclusions: ExclusionDto[]
  selectableBytes: number
}

export interface PlanTierDto {
  tier: Tier
  itemCount: number
  estimatedBytes: number
}

export interface PlanDto {
  itemCount: number
  estimatedBytes: number
  tiers: PlanTierDto[]
  json: string
}

/** Destino do que um tier remove: Lixeira (recuperável) ou definitivo. */
export type Disposal = 'trash' | 'permanent'

export interface ApprovalDto {
  tiers: Tier[]
  itemCount: number
  estimatedBytes: number
  /** Destino de cada tier aprovado, fixado na aprovação. */
  disposals: Partial<Record<Tier, Disposal>>
}

export interface StepDto {
  id: string
  label: TextDto
  tier: Tier
  kind: ActionKind
  target: string
  estimatedBytes: number
  /** Destino do caminho; `null` para comando e desinstalação. */
  disposal: Disposal | null
}

export type ItemStatus = 'ok' | 'partial' | 'skipped' | 'failed'

export type CauseCode =
  | 'partial_os'
  | 'partial_locked'
  | 'missing'
  | 'too_broad'
  | 'protected'
  | 'uninstall_unsupported'
  | 'io'
  | 'exit'

export interface CauseDto {
  code: CauseCode
  detail: string | null
  exitCode: number | null
}

export interface ItemResultDto {
  id: string
  label: TextDto
  tier: Tier
  estimatedBytes: number
  /** Espaço livre ganho; negativo se o volume encheu durante o item. */
  freedBytes: number
  status: ItemStatus
  cause: CauseDto | null
  /** Movido para a Lixeira: não entra em `freedBytes` até ela ser esvaziada. */
  trashedBytes: number
}

export interface TierRunDto {
  tier: Tier
  freeBeforeBytes: number
  freeAfterBytes: number
  freedBytes: number
  estimatedBytes: number
  trashedBytes: number
  items: ItemResultDto[]
}

export interface ExecutionEventDto {
  kind: 'started' | 'finished'
  id: string
  result: ItemResultDto | null
}

export interface ReportDto {
  initial: VolumeDto
  last: VolumeDto
  freedBytes: number
  estimatedBytes: number
  /** Total movido para a Lixeira na sessão. */
  trashedBytes: number
  itemCount: number
  runs: TierRunDto[]
  pending: ItemResultDto[]
  blocked: CandidateDto[]
  exclusions: ExclusionDto[]
}

export interface UpdateInfo {
  version: string
  currentVersion: string
  notes: string | null
  date: string | null
}

export interface UpdateProgress {
  downloaded: number
  total: number | null
  /** 0–100; `null` quando o servidor não informa o tamanho. */
  percent: number | null
}
