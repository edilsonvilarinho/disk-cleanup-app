//! Shell desktop. `service`, `dto` e `error` são testados; `bootstrap` é a raiz
//! de composição (liga adaptadores concretos aos comandos Tauri).

mod bootstrap;
mod dto;
mod error;
mod export;
mod service;
mod update;

pub use bootstrap::run;
pub use dto::{
    ApprovalDto, BlockDto, CandidateDto, CauseDto, ClassificationDto, ExclusionDto,
    ExecutionEventDto, ItemResultDto, PlanDto, PlanTierDto, ReportDto, SkippedDto, StepDto,
    SurveyDto, SurveyRequestDto, SystemInfoDto, TextDto, TierRunDto, UsageEntryDto, VolumeDto,
};
pub use error::ErrorDto;
pub use export::{
    suggested_png_name, validate_png, with_png_extension, MAX_PNG_BYTES, PNG_SIGNATURE,
};
pub use service::{
    approve_plan, build_plan, classify, execute_tier, preview_tier, report, run_survey,
    safety_guard, system_info, CallbackExecution, CallbackProgress, Session,
};
pub use update::{
    beta_manifest_url, manifest_url, releases_api_url, stable_manifest_url, DownloadProgress,
    UpdateInfoDto, UpdateProgressDto, UPDATE_REPOSITORY,
};
