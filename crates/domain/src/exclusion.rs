use crate::path_is_within;

/// Caminho que nunca pode entrar num plano de limpeza.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Exclusion {
    pub pattern: String,
    pub reason: String,
}

/// Lista de exclusões. A linha de base do Windows é obrigatória: entradas
/// extras só acrescentam, nunca removem.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ExclusionList {
    entries: Vec<Exclusion>,
}

impl ExclusionList {
    /// Exclusões obrigatórias da skill (`SKILL.md` / `catalog.md`).
    pub fn windows_baseline(system_drive: &str, local_app_data: &str) -> Self {
        let drive = system_drive.trim_end_matches(['\\', '/']);
        let base = [
            (
                format!(r"{drive}\Windows\Installer"),
                "cache do MSI; sem ele a desinstalação quebra",
            ),
            (format!(r"{drive}\Windows\WinSxS"), "só via DISM"),
            (
                format!(r"{drive}\ProgramData\Package Cache"),
                "instaladores usados para desinstalar",
            ),
            (
                format!(r"{drive}\Program Files\WindowsApps"),
                "gerenciado só pela Store",
            ),
            (
                format!(r"{drive}\pagefile.sys"),
                "ajuste só com medição de RAM/commit",
            ),
            (
                format!(r"{local_app_data}\Packages\*\LocalState"),
                "dado do app, não cache",
            ),
            (
                format!(r"{drive}\Windows\System32\DriverStore"),
                "driver store",
            ),
            (
                format!(r"{drive}\ProgramData\Microsoft\Search"),
                "índice do Windows",
            ),
        ];
        base.into_iter()
            .fold(Self::default(), |list, (pattern, reason)| {
                list.with(&pattern, reason)
            })
    }

    /// Acrescenta uma exclusão (padrão aceita `*` como segmento curinga).
    pub fn with(mut self, pattern: &str, reason: &str) -> Self {
        self.entries.push(Exclusion {
            pattern: pattern.to_string(),
            reason: reason.to_string(),
        });
        self
    }

    pub fn matching(&self, path: &str) -> Option<&Exclusion> {
        self.entries
            .iter()
            .find(|e| path_is_within(path, &e.pattern))
    }

    pub fn entries(&self) -> &[Exclusion] {
        &self.entries
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}
