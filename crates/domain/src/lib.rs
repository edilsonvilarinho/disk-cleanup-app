//! Domínio do Disk Cleanup: regras de negócio puras, sem I/O e sem dependência
//! de sistema operacional. Tudo aqui é determinístico e testável isoladamente.

mod aggregation;
mod candidate;
mod error;
mod exclusion;
mod guard;
mod path;
mod plan;
mod size;
mod tier;
mod volume;

pub use aggregation::{AggregateEntry, FocusRoot, SizeAggregator};
pub use candidate::{Action, Availability, Candidate, Risk};
pub use error::DomainError;
pub use exclusion::{Exclusion, ExclusionList};
pub use guard::ToolchainGuard;
pub use path::{is_cloud_folder_name, path_components, path_is_within};
pub use plan::{approve, ApprovalError, ApprovedPlan, Decision, Plan, PlanError, PlanItem};
pub use size::ByteSize;
pub use tier::Tier;
pub use volume::{VolumeHealth, VolumeUsage};
