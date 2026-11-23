use disk_cleanup_application::Environment;
use disk_cleanup_domain::ExclusionList;

/// Exclusões obrigatórias do sistema `os` (`std::env::consts::OS`). Escolha em
/// tempo de execução, para as três linhas de base serem testadas em qualquer máquina.
pub fn exclusions_for(os: &str, env: &dyn Environment) -> ExclusionList {
    match os {
        "windows" => {
            let drive = env.var("SystemDrive").unwrap_or_else(|| "C:".to_string());
            let local = env
                .var("LOCALAPPDATA")
                .unwrap_or_else(|| format!(r"{drive}\Users\*\AppData\Local"));
            ExclusionList::windows_baseline(&drive, &local)
        }
        "linux" => {
            ExclusionList::linux_baseline(&env.var("HOME").unwrap_or_else(|| "/home/*".to_string()))
        }
        "macos" => ExclusionList::macos_baseline(
            &env.var("HOME").unwrap_or_else(|| "/Users/*".to_string()),
        ),
        _ => ExclusionList::default(),
    }
}
