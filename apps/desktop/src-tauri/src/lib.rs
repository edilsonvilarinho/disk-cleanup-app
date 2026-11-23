//! Shell desktop. `service`, `dto` e `error` são testados; `bootstrap` é a raiz
//! de composição (liga adaptadores concretos aos comandos Tauri).

mod bootstrap;
mod dto;
mod error;
mod service;

pub use bootstrap::run;
pub use dto::{
    ApprovalDto, BlockDto, CandidateDto, CauseDto, ClassificationDto, ExclusionDto,
    ExecutionEventDto, ItemResultDto, PlanDto, PlanTierDto, ReportDto, SkippedDto, StepDto,
    SurveyDto, SurveyRequestDto, SystemInfoDto, TextDto, TierRunDto, UsageEntryDto, VolumeDto,
};
pub use error::ErrorDto;
pub use service::{
    approve_plan, build_plan, classify, execute_tier, preview_tier, report, run_survey,
    safety_guard, system_info, CallbackExecution, CallbackProgress, Session,
};
