import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { DiskCleanupGateway, SurveyRequest } from '../application/gateway'
import type {
  ApprovalDto,
  ClassificationDto,
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

const PROGRESS_EVENT = 'survey-progress'
const EXECUTION_EVENT = 'execution-progress'

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

  classify(extraExclusions: string[]): Promise<ClassificationDto> {
    return this.call<ClassificationDto>('classify', { extraExclusions })
  }

  buildPlan(volume: string, selected: string[]): Promise<PlanDto> {
    return this.call<PlanDto>('build_plan', { volume, selected })
  }

  approvePlan(tiers: Tier[], acknowledged: boolean): Promise<ApprovalDto> {
    return this.call<ApprovalDto>('approve_plan', { tiers, acknowledged })
  }

  previewTier(tier: Tier): Promise<StepDto[]> {
    return this.call<StepDto[]>('preview_tier', { tier })
  }

  async executeTier(tier: Tier, onEvent: (event: ExecutionEventDto) => void): Promise<TierRunDto> {
    const unlisten = await this.subscribe<ExecutionEventDto>(EXECUTION_EVENT, (event) => onEvent(event.payload))
    try {
      return await this.call<TierRunDto>('execute_tier', { tier })
    } finally {
      unlisten()
    }
  }

  report(): Promise<ReportDto> {
    return this.call<ReportDto>('report')
  }
}
