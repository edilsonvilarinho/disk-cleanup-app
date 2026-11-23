use crate::{path_is_within, LocalizedText};

/// Caminho que nunca pode entrar num plano de limpeza.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Exclusion {
    pub pattern: String,
    pub reason: LocalizedText,
}

/// Lista de exclusões. A linha de base da plataforma é obrigatória: entradas
/// extras (catálogo, Configurações) só acrescentam, nunca removem.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ExclusionList {
    entries: Vec<Exclusion>,
}

fn text(pt: &str, en: &str) -> LocalizedText {
    LocalizedText::new(pt, en)
}

impl ExclusionList {
    fn from_pairs(pairs: Vec<(String, LocalizedText)>) -> Self {
        pairs
            .into_iter()
            .fold(Self::default(), |list, (pattern, reason)| {
                list.with(&pattern, reason)
            })
    }

    /// Exclusões obrigatórias da skill (`SKILL.md` / `catalog.md`).
    pub fn windows_baseline(system_drive: &str, local_app_data: &str) -> Self {
        let d = system_drive.trim_end_matches(['\\', '/']);
        Self::from_pairs(vec![
            (
                format!(r"{d}\Windows\Installer"),
                text(
                    "cache do MSI; sem ele a desinstalação quebra",
                    "MSI cache; without it uninstalling breaks",
                ),
            ),
            (
                format!(r"{d}\Windows\WinSxS"),
                text("só via DISM", "only through DISM"),
            ),
            (
                format!(r"{d}\ProgramData\Package Cache"),
                text(
                    "instaladores usados para desinstalar",
                    "installers needed to uninstall",
                ),
            ),
            (
                format!(r"{d}\Program Files\WindowsApps"),
                text("gerenciado só pela Store", "managed by the Store only"),
            ),
            (
                format!(r"{d}\pagefile.sys"),
                text(
                    "ajuste só com medição de RAM/commit",
                    "tune only after measuring RAM/commit",
                ),
            ),
            (
                format!(r"{local_app_data}\Packages\*\LocalState"),
                text("dado do app, não cache", "app data, not cache"),
            ),
            (
                format!(r"{d}\Windows\System32\DriverStore"),
                text("driver store", "driver store"),
            ),
            (
                format!(r"{d}\ProgramData\Microsoft\Search"),
                text("índice do Windows", "Windows search index"),
            ),
        ])
    }

    /// Sistema, gerenciadores de pacote e segredos do usuário no Linux.
    pub fn linux_baseline(home: &str) -> Self {
        let system = text("sistema de arquivos do sistema", "system file system");
        let packages = text(
            "banco do gerenciador de pacotes",
            "package manager database",
        );
        let secrets = text(
            "chaves e credenciais do usuário",
            "user keys and credentials",
        );
        let mut pairs: Vec<(String, LocalizedText)> =
            ["/proc", "/sys", "/dev", "/run", "/boot", "/usr", "/etc"]
                .iter()
                .map(|p| (p.to_string(), system.clone()))
                .collect();
        pairs.extend(
            ["/var/lib/dpkg", "/var/lib/rpm", "/var/lib/pacman"]
                .iter()
                .map(|p| (p.to_string(), packages.clone())),
        );
        pairs.extend(
            [".ssh", ".gnupg", ".local/share/keyrings", ".pki"]
                .iter()
                .map(|p| (format!("{home}/{p}"), secrets.clone())),
        );
        Self::from_pairs(pairs)
    }

    /// Sistema, iCloud, backups de dispositivos e chaves no macOS.
    pub fn macos_baseline(home: &str) -> Self {
        let system = text("protegido pelo sistema (SIP)", "system protected (SIP)");
        let mut pairs: Vec<(String, LocalizedText)> =
            ["/System", "/usr", "/bin", "/sbin", "/private/var/db"]
                .iter()
                .map(|p| (p.to_string(), system.clone()))
                .collect();
        pairs.extend([
            (
                format!("{home}/Library/Keychains"),
                text("chaves e senhas do usuário", "user keychains"),
            ),
            (
                format!("{home}/Library/Mobile Documents"),
                text(
                    "iCloud Drive: liberar pelo Finder, nunca remover",
                    "iCloud Drive: free it from Finder, never delete",
                ),
            ),
            (
                format!("{home}/Library/Application Support/MobileSync"),
                text("backups de iPhone/iPad", "iPhone/iPad backups"),
            ),
            (
                format!("{home}/Library/Mail"),
                text("dados do Mail", "Mail data"),
            ),
            (
                format!("{home}/Library/Messages"),
                text("dados do Mensagens", "Messages data"),
            ),
        ]);
        Self::from_pairs(pairs)
    }

    /// Acrescenta uma exclusão (padrão aceita `*` como segmento curinga).
    pub fn with(mut self, pattern: &str, reason: LocalizedText) -> Self {
        self.entries.push(Exclusion {
            pattern: pattern.to_string(),
            reason,
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
