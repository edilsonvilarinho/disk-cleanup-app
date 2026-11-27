use crate::{path_components, path_is_within};

/// Motivo de a guarda recusar um alvo de remoção.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SafetyViolation {
    /// Menos segmentos que o mínimo (raiz, `C:\Users`, `/home`).
    TooBroad { target: String },
    /// Igual a uma pasta protegida (perfil, AppData, Program Files…).
    Protected { path: String },
}

/// Mínimo de segmentos de um alvo removível: `C:\Users\u\x` (4) passa,
/// `C:\Users\u` (3) precisa estar fora da lista de protegidos, `C:\Users` (2) nunca.
const MIN_SEGMENTS: usize = 3;

/// Última trava antes de remover: recusa alvo amplo demais ou igual a uma
/// pasta protegida (perfil, AppData, ProgramData, Program Files…), mesmo que
/// o catálogo — que é dado editável — peça.
#[derive(Debug, Clone, Default)]
pub struct SafetyGuard {
    protected: Vec<String>,
}

impl SafetyGuard {
    pub fn new(protected: Vec<String>) -> Self {
        Self {
            protected: protected.into_iter().filter(|p| !p.is_empty()).collect(),
        }
    }

    pub fn check(&self, target: &str) -> Result<(), SafetyViolation> {
        if path_components(target).len() < MIN_SEGMENTS {
            return Err(SafetyViolation::TooBroad {
                target: target.to_string(),
            });
        }
        if let Some(p) = self
            .protected
            .iter()
            // Igual a uma protegida ou contendo uma (`p` dentro de `target`).
            .find(|p| path_is_within(p, target))
        {
            return Err(SafetyViolation::Protected { path: p.clone() });
        }
        Ok(())
    }
}
