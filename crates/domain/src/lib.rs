//! Domínio do Disk Cleanup: regras de negócio puras, sem I/O e sem dependência
//! de sistema operacional. Tudo aqui é determinístico e testável isoladamente.

mod aggregation;
mod candidate;
mod disposal;
mod error;
mod exclusion;
mod execution;
mod guard;
mod path;
mod plan;
mod report;
mod safety;
mod size;
mod text;
mod tier;
mod top_files;
mod volume;

pub use aggregation::{AggregateEntry, FocusRoot, SizeAggregator};
pub use candidate::{Action, Availability, BlockReason, Candidate, Risk};
pub use disposal::Disposal;
pub use error::DomainError;
pub use exclusion::{Exclusion, ExclusionList};
pub use execution::{signed_delta, FailCause, ItemResult, ItemStatus, SkipCause, TierRun};
pub use guard::ToolchainGuard;
pub use path::{is_cloud_folder_name, path_components, path_is_within};
pub use plan::{approve, ApprovalError, ApprovedPlan, Decision, Plan, PlanError, PlanItem};
pub use report::CleanupReport;
pub use safety::{SafetyGuard, SafetyViolation};
pub use size::ByteSize;
pub use text::LocalizedText;
pub use tier::Tier;
pub use top_files::{LargeFile, TopFiles};
pub use volume::{VolumeHealth, VolumeUsage};
