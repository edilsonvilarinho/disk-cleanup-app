// Porta para o núcleo: a interface não conhece Tauri, só este contrato (DIP).
import type {
  ApprovalDto,
  ClassificationDto,
  Disposal,
  ExecutionEventDto,
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

export interface DiskCleanupGateway {
  systemInfo(): Promise<SystemInfoDto>
  runSurvey(request: SurveyRequest, onProgress: (progress: ScanProgressDto) => void): Promise<SurveyDto>
  classify(extraExclusions: string[]): Promise<ClassificationDto>
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
