use disk_cleanup_domain::{DomainError, PlanError};
use thiserror::Error;

use crate::PortError;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum AppError {
    #[error("requisição inválida: {0}")]
    InvalidRequest(String),
    #[error(transparent)]
    Port(#[from] PortError),
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error(transparent)]
    Plan(#[from] PlanError),
}
