use crate::{ByteSize, Tier};

/// O que executar para liberar o espaço de um candidato.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    /// Remover arquivo/diretório.
    RemovePath { path: String },
    /// Executar um comando (ex.: `npm cache clean --force`, `DISM ...`).
    Command { command: String },
    /// Rodar o desinstalador registrado e remover resíduos conhecidos.
    Uninstall {
        display_name: String,
        also_remove: Vec<String>,
    },
}

impl Action {
    /// Nome do tipo no formato do `plan.json` da skill.
    pub fn kind(&self) -> &'static str {
        match self {
            Action::RemovePath { .. } => "path",
            Action::Command { .. } => "command",
            Action::Uninstall { .. } => "uninstall",
        }
    }

    /// Caminhos que a ação remove diretamente (verificados contra exclusões).
    pub fn touched_paths(&self) -> Vec<&str> {
        match self {
            Action::RemovePath { path } => vec![path.as_str()],
            Action::Command { .. } => Vec::new(),
            Action::Uninstall { also_remove, .. } => {
                also_remove.iter().map(String::as_str).collect()
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Risk {
    /// Nada além do re-download do cache.
    None,
    /// Reversível só reinstalando.
    Low,
    /// Custo de re-download relevante.
    Redownload,
    /// Operação longa (DISM etc.).
    LongRunning,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Availability {
    Selectable,
    /// Existe, mas não pode entrar no plano (ex.: ferramenta ainda no PATH).
    Blocked {
        reason: String,
    },
}

impl Availability {
    pub fn is_selectable(&self) -> bool {
        matches!(self, Availability::Selectable)
    }
}

/// Item encontrado no disco que pode liberar espaço.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Candidate {
    pub id: String,
    pub label: String,
    pub tier: Tier,
    pub action: Action,
    pub size: ByteSize,
    pub risk: Risk,
    pub note: String,
    pub availability: Availability,
}
