//! Camada de aplicação: casos de uso orquestrando o domínio através de portas.
//! Nenhum acesso direto a disco, registro ou SO: tudo entra por trait (DIP).

mod catalog;
mod classify;
mod error;
mod execute;
mod plan;
mod ports;
mod survey;
mod template;

pub use catalog::{Catalog, CatalogExclusion, CatalogRule, RuleTarget};
pub use classify::{ClassificationReport, ClassifyService, SkipReason, SkippedRule};
pub use error::AppError;
pub use execute::{ExecuteService, PlannedStep};
pub use plan::export_plan;
pub use ports::{
    ActionRunner, CatalogRepository, CommandOutcome, Environment, ExecutionProgress, FileRecord,
    FileWalker, PathInspector, PlanCodec, PortError, RemovalOutcome, ScanProgress, VolumeInfo,
    WalkStats,
};
pub use survey::{SurveyReport, SurveyRequest, SurveyService};
pub use template::expand_template;
