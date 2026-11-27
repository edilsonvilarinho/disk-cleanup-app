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
    /// Última modificação (segundos Unix), quando o sistema informa.
    pub modified: Option<u64>,
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

/// Resultado de uma remoção best-effort: o que saiu, o que ficou e por quê.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemovalOutcome {
    pub removed: ByteSize,
    pub remaining: ByteSize,
    /// Primeiros erros (arquivo em uso, permissão).
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandOutcome {
    pub success: bool,
    pub code: Option<i32>,
    pub output: String,
}

/// Artefato regenerável encontrado dentro de um projeto.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FoundArtifact {
    /// `id` do `ProjectProfile` que o reconheceu.
    pub profile: String,
    /// Raiz do projeto (onde está o marcador).
    pub project: String,
    /// Diretório do artefato.
    pub path: String,
    /// Dias desde a atividade mais recente no projeto, fora dos artefatos.
    pub idle_days: Option<u32>,
}

/// Procura projetos nas pastas dadas. Somente leitura; nunca segue link.
pub trait ProjectFinder {
    fn find(&self, roots: &[String], profiles: &[crate::ProjectProfile]) -> Vec<FoundArtifact>;
}

/// Executa as ações de um plano aprovado. `remove_path` e `trash_path` devolvem
/// `PortError::NotFound` se o caminho não existe.
pub trait ActionRunner {
    fn remove_path(&self, path: &str) -> Result<RemovalOutcome, PortError>;
    /// Move para a Lixeira do sistema, best-effort como `remove_path`:
    /// `removed` é o que foi para a Lixeira, `remaining` o que ficou no lugar.
    fn trash_path(&self, path: &str) -> Result<RemovalOutcome, PortError>;
    fn run_command(&self, command: &str) -> Result<CommandOutcome, PortError>;
}

/// Eventos por item, para a UI acompanhar a execução.
pub trait ExecutionProgress {
    fn item_started(&self, id: &str);
    fn item_finished(&self, result: &disk_cleanup_domain::ItemResult);
}
