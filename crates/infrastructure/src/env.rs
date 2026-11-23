use std::ffi::OsString;

use disk_cleanup_application::Environment;

/// Fotografia imutável das variáveis de ambiente. Ler uma vez e injetar evita
/// estado global mutável e torna o adaptador testável sem `set_var`.
#[derive(Debug, Clone, Default)]
pub struct SnapshotEnvironment {
    vars: Vec<(String, String)>,
}

impl SnapshotEnvironment {
    pub fn from_process() -> Self {
        Self::from_pairs(
            std::env::vars_os()
                .map(|(k, v)| {
                    (
                        k.to_string_lossy().into_owned(),
                        v.to_string_lossy().into_owned(),
                    )
                })
                .collect(),
        )
    }

    pub fn from_pairs(vars: Vec<(String, String)>) -> Self {
        Self { vars }
    }
}

impl Environment for SnapshotEnvironment {
    /// Sem diferenciar maiúsculas (semântica do Windows; inofensivo em Unix).
    fn var(&self, name: &str) -> Option<String> {
        self.vars
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.clone())
    }

    fn vars(&self) -> Vec<(String, String)> {
        self.vars.clone()
    }

    fn path_entries(&self) -> Vec<String> {
        let Some(path) = self.var("PATH") else {
            return Vec::new();
        };
        std::env::split_paths(&OsString::from(path))
            .map(|p| p.to_string_lossy().into_owned())
            .filter(|p| !p.is_empty())
            .collect()
    }
}
