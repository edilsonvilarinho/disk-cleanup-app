// Contratos com o núcleo Rust (DTOs camelCase de src-tauri/src/dto.rs).

export type Tier = 'A' | 'B' | 'C' | 'D'
export type Risk = 'none' | 'low' | 'redownload' | 'long-running'
export type Health = 'healthy' | 'warning' | 'critical'
export type ActionKind = 'path' | 'command' | 'uninstall'

export interface SystemInfoDto {
  os: string
  volumeRoot: string
  profile: string | null
  catalog: string
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
}

export interface ScanProgressDto {
  files: number
  logicalBytes: number
}

export interface CandidateDto {
  id: string
  label: string
  tier: Tier
  kind: ActionKind
  target: string
  sizeBytes: number
  risk: Risk
  note: string
  blockedReason: string | null
}

export interface SkippedDto {
  id: string
  reason: string
}

export interface ExclusionDto {
  pattern: string
  reason: string
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
