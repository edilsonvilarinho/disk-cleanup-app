//! Shell desktop. `service` e `dto` são testados; `bootstrap` é a raiz de
//! composição (liga adaptadores concretos aos comandos Tauri).

mod bootstrap;
mod dto;
mod service;

pub use bootstrap::run;
pub use dto::{
    ApprovalDto, CandidateDto, ClassificationDto, ExclusionDto, ExecutionEventDto, ItemResultDto,
    PlanDto, PlanTierDto, ReportDto, SkippedDto, StepDto, SurveyDto, SurveyRequestDto,
    SystemInfoDto, TierRunDto, UsageEntryDto, VolumeDto,
};
pub use service::{
    approve_plan, build_plan, classify, execute_tier, preview_tier, report, run_survey,
    safety_guard, system_info, CallbackExecution, CallbackProgress, Session,
};
