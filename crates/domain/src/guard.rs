use crate::{path_is_within, BlockReason};

/// Impede remover ferramenta que o ambiente ainda referencia (pitfall #5):
/// variável de ambiente apontando para o alvo, ou entrada do PATH dentro dele.
#[derive(Debug, Clone, Default)]
pub struct ToolchainGuard {
    env_vars: Vec<(String, String)>,
    path_entries: Vec<String>,
}

impl ToolchainGuard {
    pub fn new(env_vars: Vec<(String, String)>, path_entries: Vec<String>) -> Self {
        Self {
            env_vars,
            path_entries,
        }
    }

    /// Motivo do bloqueio, se houver. `watched_vars` são as variáveis que a regra
    /// do catálogo declara como relevantes para o alvo (ex.: `CUDA_PATH`).
    pub fn blocking_reason(&self, target: &str, watched_vars: &[String]) -> Option<BlockReason> {
        let by_var = self.env_vars.iter().find(|(name, value)| {
            watched_vars.iter().any(|w| w.eq_ignore_ascii_case(name))
                && (path_is_within(value, target) || path_is_within(target, value))
        });
        if let Some((name, _)) = by_var {
            return Some(BlockReason::EnvVar { name: name.clone() });
        }
        self.path_entries
            .iter()
            .find(|entry| !entry.is_empty() && path_is_within(entry, target))
            .map(|entry| BlockReason::PathEntry {
                entry: entry.clone(),
            })
    }
}
