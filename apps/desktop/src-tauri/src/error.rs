//! Erros para a interface: código estável + parâmetros. A tradução fica na UI.

use std::collections::BTreeMap;

use disk_cleanup_application::{AppError, PortError};
use disk_cleanup_domain::{ApprovalError, DomainError, PlanError};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ErrorDto {
    pub code: String,
    pub params: BTreeMap<String, String>,
}

impl ErrorDto {
    pub fn new(code: &str) -> Self {
        Self {
            code: code.to_string(),
            params: BTreeMap::new(),
        }
    }

    pub fn with(mut self, key: &str, value: impl ToString) -> Self {
        self.params.insert(key.to_string(), value.to_string());
        self
    }
}

impl From<PortError> for ErrorDto {
    fn from(e: PortError) -> Self {
        let (code, detail) = match e {
            PortError::Io(d) => ("io", d),
            PortError::NotFound(d) => ("not_found", d),
            PortError::InvalidData(d) => ("invalid_data", d),
            PortError::Unsupported(d) => ("unsupported", d),
        };
        Self::new(code).with("detail", detail)
    }
}

impl From<DomainError> for ErrorDto {
    fn from(e: DomainError) -> Self {
        match e {
            DomainError::InvalidVolume(d) => Self::new("invalid_volume").with("detail", d),
            DomainError::UnknownTier(v) => Self::new("unknown_tier").with("value", v),
            DomainError::UnknownDisposal(v) => Self::new("unknown_disposal").with("value", v),
            DomainError::InvalidChoice { decision, index } => Self::new("invalid_choice")
                .with("decision", decision)
                .with("index", index),
        }
    }
}

impl From<PlanError> for ErrorDto {
    fn from(e: PlanError) -> Self {
        match e {
            PlanError::Empty => Self::new("plan_empty"),
            PlanError::UnknownCandidate(id) => Self::new("plan_unknown_candidate").with("id", id),
            PlanError::Duplicate(id) => Self::new("plan_duplicate").with("id", id),
            PlanError::Blocked { id, .. } => Self::new("plan_blocked").with("id", id),
            PlanError::Excluded { id, path, .. } => {
                Self::new("plan_excluded").with("id", id).with("path", path)
            }
        }
    }
}

impl From<ApprovalError> for ErrorDto {
    fn from(e: ApprovalError) -> Self {
        match e {
            ApprovalError::PendingDecisions(ids) => {
                Self::new("approval_pending").with("ids", ids.join(", "))
            }
            ApprovalError::NoTierApproved => Self::new("approval_no_tier"),
            ApprovalError::NotAcknowledged => Self::new("approval_not_acknowledged"),
            ApprovalError::TierNotInPlan(t) => {
                Self::new("approval_tier_not_in_plan").with("tier", t)
            }
        }
    }
}

impl From<AppError> for ErrorDto {
    fn from(e: AppError) -> Self {
        match e {
            AppError::InvalidDepth(d) => Self::new("invalid_depth").with("depth", d),
            AppError::TierNotApproved(t) => Self::new("tier_not_approved").with("tier", t),
            AppError::Port(p) => p.into(),
            AppError::Domain(d) => d.into(),
            AppError::Plan(p) => p.into(),
        }
    }
}
