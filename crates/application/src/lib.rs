//! Camada de aplicação: casos de uso orquestrando o domínio através de portas.
//! Nenhum acesso direto a disco, registro ou SO: tudo entra por trait (DIP).

mod catalog;
mod classify;
mod duplicates;
mod error;
mod execute;
mod plan;
mod ports;
mod survey;
mod template;

pub use catalog::{Catalog, CatalogExclusion, CatalogRule, ProjectProfile, RuleTarget};
pub use classify::{
    effective_exclusions, ClassificationReport, ClassifyService, DuplicateInfo, LargeFileInfo,
    OrphanInfo, ProjectInfo, SkipReason, SkippedRule,
};
pub use duplicates::{
    ContentHasher, DuplicateGroup, DuplicateReport, DuplicateService, DuplicateStats,
};
pub use error::AppError;
pub use execute::{protected_paths_guard, ExecuteService, PlannedStep};
pub use plan::export_plan;
pub use ports::{
    ActionRunner, CatalogRepository, CommandOutcome, Environment, ExecutionProgress, FileRecord,
    FileWalker, FolderInfo, FoundArtifact, OrphanFinder, PathInspector, PlanCodec, PortError,
    ProjectFinder, RemovalOutcome, ScanProgress, VolumeInfo, WalkStats,
};
pub use survey::{SurveyReport, SurveyRequest, SurveyService};
pub use template::expand_template;
