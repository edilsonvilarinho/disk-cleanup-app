//! Shell desktop. `service` e `dto` são testados; `bootstrap` é a raiz de
//! composição (liga adaptadores concretos aos comandos Tauri).

mod bootstrap;
mod dto;
mod service;

pub use bootstrap::run;
pub use dto::{
    CandidateDto, ClassificationDto, ExclusionDto, PlanDto, PlanTierDto, SkippedDto, SurveyDto,
    SurveyRequestDto, SystemInfoDto, UsageEntryDto, VolumeDto,
};
pub use service::{build_plan, classify, run_survey, system_info, CallbackProgress, Session};
