import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { DiskCleanupGateway, SurveyRequest } from '../application/gateway'
import type { ClassificationDto, PlanDto, ScanProgressDto, SurveyDto, SystemInfoDto } from '../domain/models'

const PROGRESS_EVENT = 'survey-progress'

/** Adaptador IPC para os comandos de `src-tauri/src/bootstrap.rs`. */
export class TauriGateway implements DiskCleanupGateway {
  constructor(
    private readonly call: typeof invoke = invoke,
    private readonly subscribe: typeof listen = listen,
  ) {}

  systemInfo(): Promise<SystemInfoDto> {
    return this.call<SystemInfoDto>('system_info')
  }

  async runSurvey(request: SurveyRequest, onProgress: (p: ScanProgressDto) => void): Promise<SurveyDto> {
    const unlisten = await this.subscribe<ScanProgressDto>(PROGRESS_EVENT, (event) => onProgress(event.payload))
    try {
      return await this.call<SurveyDto>('run_survey', { request })
    } finally {
      unlisten()
    }
  }

  classify(): Promise<ClassificationDto> {
    return this.call<ClassificationDto>('classify')
  }

  buildPlan(volume: string, selected: string[]): Promise<PlanDto> {
    return this.call<PlanDto>('build_plan', { volume, selected })
  }
}
