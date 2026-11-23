use thiserror::Error;

/// Violações de invariantes do domínio.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum DomainError {
    #[error("volume inválido: {0}")]
    InvalidVolume(String),
    #[error("tier desconhecido: {0}")]
    UnknownTier(String),
    #[error("opção {index} inexistente na decisão '{decision}'")]
    InvalidChoice { decision: String, index: usize },
}
