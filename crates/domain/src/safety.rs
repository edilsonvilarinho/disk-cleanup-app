use crate::{path_components, path_is_within};

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

    pub fn check(&self, target: &str) -> Result<(), String> {
        if path_components(target).len() < MIN_SEGMENTS {
            return Err(format!("alvo amplo demais para remoção: {target:?}"));
        }
        if let Some(p) = self
            .protected
            .iter()
            .find(|p| path_is_within(target, p) && path_is_within(p, target))
        {
            return Err(format!(
                "alvo protegido (pasta do sistema ou do usuário): {p}"
            ));
        }
        Ok(())
    }
}
