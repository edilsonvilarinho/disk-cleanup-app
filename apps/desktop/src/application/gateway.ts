// Porta para o núcleo: a interface não conhece Tauri, só este contrato (DIP).
import type { ClassificationDto, PlanDto, ScanProgressDto, SurveyDto, SystemInfoDto } from '../domain/models'

export interface SurveyRequest {
  volumeRoot: string
  profile: string | null
  depth: 1 | 2
}

export interface DiskCleanupGateway {
  systemInfo(): Promise<SystemInfoDto>
  runSurvey(request: SurveyRequest, onProgress: (progress: ScanProgressDto) => void): Promise<SurveyDto>
  classify(): Promise<ClassificationDto>
  buildPlan(volume: string, selected: string[]): Promise<PlanDto>
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
