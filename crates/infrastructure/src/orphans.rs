use std::fs;
use std::time::SystemTime;

use disk_cleanup_application::{FolderInfo, OrphanFinder};
use disk_cleanup_domain::InstalledApp;

use crate::projects::idle_days_of;
use crate::runner::is_link;

/// Programas do registro de desinstalação (Windows) e subpastas das pastas de
/// dados de apps. Fora do Windows não há fonte confiável: `installed` é `None`
/// e nenhuma sobra é inventada. Somente leitura.
#[derive(Debug, Clone, Copy)]
pub struct RegistryOrphanFinder {
    now: SystemTime,
}

impl Default for RegistryOrphanFinder {
    fn default() -> Self {
        Self::at(SystemTime::now())
    }
}

impl RegistryOrphanFinder {
    pub fn at(now: SystemTime) -> Self {
        Self { now }
    }
}

impl OrphanFinder for RegistryOrphanFinder {
    fn installed(&self) -> Option<Vec<InstalledApp>> {
        installed_apps()
    }

    fn folders(&self, root: &str) -> Vec<FolderInfo> {
        let Ok(entries) = fs::read_dir(root) else {
            return Vec::new();
        };
        let mut out: Vec<FolderInfo> = entries
            .flatten()
            .filter_map(|e| {
                let meta = fs::symlink_metadata(e.path()).ok()?;
                (meta.is_dir() && !is_link(&meta)).then(|| FolderInfo {
                    name: e.file_name().to_string_lossy().into_owned(),
                    path: e.path().to_string_lossy().into_owned(),
                    idle_days: idle_days_of(&e.path(), self.now),
                })
            })
            .collect();
        out.sort_by(|a, b| a.name.cmp(&b.name));
        out
    }
}

#[cfg(windows)]
fn installed_apps() -> Option<Vec<InstalledApp>> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    const KEYS: [&str; 2] = [
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ];
    let mut apps = Vec::new();
    for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
        let root = RegKey::predef(hive);
        for path in KEYS {
            let Ok(key) = root.open_subkey(path) else {
                continue;
            };
            for name in key.enum_keys().flatten() {
                let Ok(app) = key.open_subkey(&name) else {
                    continue;
                };
                let get = |v: &str| app.get_value::<String, _>(v).unwrap_or_default();
                let display = get("DisplayName");
                if display.is_empty() {
                    continue;
                }
                apps.push(InstalledApp {
                    name: display,
                    publisher: get("Publisher"),
                    location: get("InstallLocation"),
                });
            }
        }
    }
    // Registro ilegível não pode virar "nada instalado": sem lista, sem sobras.
    (!apps.is_empty()).then_some(apps)
}

#[cfg(not(windows))]
fn installed_apps() -> Option<Vec<InstalledApp>> {
    None
}
