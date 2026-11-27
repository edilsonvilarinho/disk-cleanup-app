// Porta para o núcleo: a interface não conhece Tauri, só este contrato (DIP).
import type {
  ApprovalDto,
  ClassificationDto,
  Disposal,
  ExecutionEventDto,
  DuplicatesDto,
  RuleCheckDto,
  UserRule,
  PlanDto,
  ReportDto,
  ScanProgressDto,
  StepDto,
  SurveyDto,
  SystemInfoDto,
  Tier,
  TierRunDto,
} from '../domain/models'

export interface SurveyRequest {
  volumeRoot: string
  profile: string | null
  depth: 1 | 2
}

/** O que a classificação recebe das Configurações. */
export interface ClassifyRequest {
  extraExclusions: string[]
  projectRoots: string[]
  userRules: UserRule[]
  disabledProfiles: string[]
  /** Sobras de apps desinstalados: experimental, desligado por padrão. */
  findOrphans: boolean
}

export const EMPTY_CLASSIFY_REQUEST: ClassifyRequest = {
  extraExclusions: [],
  projectRoots: [],
  userRules: [],
  disabledProfiles: [],
  findOrphans: false,
}

export interface DiskCleanupGateway {
  systemInfo(): Promise<SystemInfoDto>
  runSurvey(request: SurveyRequest, onProgress: (progress: ScanProgressDto) => void): Promise<SurveyDto>
  classify(request: ClassifyRequest): Promise<ClassificationDto>
  /** Busca duplicados no perfil (só leitura); a próxima classificação inclui as cópias. */
  findDuplicates(): Promise<DuplicatesDto>
  /** Valida a pasta de uma regra própria antes de salvar. */
  checkRule(extraExclusions: string[], path: string): Promise<RuleCheckDto>
  buildPlan(volume: string, selected: string[]): Promise<PlanDto>
  /** `disposals`: destino de cada tier; tier ausente usa o padrão do núcleo. */
  approvePlan(tiers: Tier[], disposals: Partial<Record<Tier, Disposal>>, acknowledged: boolean): Promise<ApprovalDto>
  previewTier(tier: Tier): Promise<StepDto[]>
  executeTier(tier: Tier, onEvent: (event: ExecutionEventDto) => void): Promise<TierRunDto>
  report(): Promise<ReportDto>
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
