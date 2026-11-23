//! Portas: o que a aplicação exige do mundo externo. Implementações vivem na
//! infraestrutura (ou em fakes de teste).

use disk_cleanup_domain::{ByteSize, Plan, VolumeUsage};
use thiserror::Error;

use crate::Catalog;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum PortError {
    #[error("erro de E/S: {0}")]
    Io(String),
    #[error("não encontrado: {0}")]
    NotFound(String),
    #[error("dados inválidos: {0}")]
    InvalidData(String),
    #[error("não suportado nesta plataforma: {0}")]
    Unsupported(String),
}

/// Arquivo visitado na varredura.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileRecord {
    pub components: Vec<String>,
    /// Tamanho lógico (o que o arquivo declara).
    pub logical: ByteSize,
    /// Espaço realmente alocado (≈0 para placeholder de nuvem).
    pub allocated: ByteSize,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct WalkStats {
    pub files: u64,
    /// Entradas que não puderam ser lidas (permissão, arquivo sumiu etc.).
    pub unreadable: u64,
}

/// Percorre todos os arquivos sob `root`, sem seguir links.
pub trait FileWalker {
    fn walk(&self, root: &str, sink: &mut dyn FnMut(FileRecord)) -> Result<WalkStats, PortError>;
}

pub trait VolumeInfo {
    fn usage(&self, volume_root: &str) -> Result<VolumeUsage, PortError>;
}

/// Recebe o progresso da varredura (para a UI).
pub trait ScanProgress {
    fn scanned(&self, files: u64, logical: ByteSize);
}

pub trait Environment {
    fn var(&self, name: &str) -> Option<String>;
    fn vars(&self) -> Vec<(String, String)>;
    fn path_entries(&self) -> Vec<String>;
}

pub trait PathInspector {
    fn exists(&self, path: &str) -> bool;
    /// Tamanho total (recursivo) do caminho.
    fn size_of(&self, path: &str) -> Result<ByteSize, PortError>;
}

pub trait CatalogRepository {
    fn load(&self) -> Result<Catalog, PortError>;
}

/// Serialização do plano no formato `plan.json` da skill.
pub trait PlanCodec {
    fn encode(&self, plan: &Plan) -> Result<String, PortError>;
    fn decode(&self, text: &str) -> Result<Plan, PortError>;
}
