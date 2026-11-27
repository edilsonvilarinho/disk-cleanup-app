import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { ClassifyRequest, DiskCleanupGateway, SurveyRequest } from '../application/gateway'
import type {
  ApprovalDto,
  ClassificationDto,
  Disposal,
  DuplicatesDto,
  RuleCheckDto,
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

  classify(request: ClassifyRequest): Promise<ClassificationDto> {
    const { extraExclusions, projectRoots, userRules, disabledProfiles } = request
    return this.call<ClassificationDto>('classify', { extraExclusions, projectRoots, customization: { userRules, disabledProfiles } })
  }

  findDuplicates(): Promise<DuplicatesDto> {
    return this.call<DuplicatesDto>('find_duplicates')
  }

  checkRule(extraExclusions: string[], path: string): Promise<RuleCheckDto> {
    return this.call<RuleCheckDto>('check_rule', { extraExclusions, path })
  }

  buildPlan(volume: string, selected: string[]): Promise<PlanDto> {
    return this.call<PlanDto>('build_plan', { volume, selected })
  }

  approvePlan(tiers: Tier[], disposals: Partial<Record<Tier, Disposal>>, acknowledged: boolean): Promise<ApprovalDto> {
    return this.call<ApprovalDto>('approve_plan', { tiers, disposals, acknowledged })
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
