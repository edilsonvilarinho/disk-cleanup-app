use disk_cleanup_application::Environment;
use disk_cleanup_domain::ExclusionList;

/// Exclusões obrigatórias do sistema operacional em execução.
#[cfg(windows)]
pub fn platform_exclusions(env: &dyn Environment) -> ExclusionList {
    let drive = env.var("SystemDrive").unwrap_or_else(|| "C:".to_string());
    let local = env
        .var("LOCALAPPDATA")
        .unwrap_or_else(|| format!(r"{drive}\Users\*\AppData\Local"));
    ExclusionList::windows_baseline(&drive, &local)
}

/// macOS/Linux: a linha de base entra junto com os catálogos dessas plataformas.
#[cfg(not(windows))]
pub fn platform_exclusions(_env: &dyn Environment) -> ExclusionList {
    ExclusionList::default()
}
