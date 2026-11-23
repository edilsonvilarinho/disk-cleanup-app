use disk_cleanup_domain::{DomainError, PlanError};
use thiserror::Error;

use crate::PortError;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum AppError {
    #[error("profundidade deve ser 1 ou 2 (recebido {0})")]
    InvalidDepth(usize),
    #[error("tier {0} não está no plano aprovado")]
    TierNotApproved(disk_cleanup_domain::Tier),
    #[error(transparent)]
    Port(#[from] PortError),
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error(transparent)]
    Plan(#[from] PlanError),
}
