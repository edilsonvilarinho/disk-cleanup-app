use disk_cleanup_domain::{
    is_cloud_folder_name, path_components, path_is_within, ExclusionList, ToolchainGuard,
};

#[test]
fn path_components_accepts_both_separators_and_ignores_empty_segments() {
    assert_eq!(
        path_components(r"C:\Users\\edils/AppData\"),
        ["C:", "Users", "edils", "AppData"]
    );
    assert_eq!(path_components("/home/edils/"), ["home", "edils"]);
    assert!(path_components("").is_empty());
}

#[test]
fn path_is_within_is_segment_based_and_case_insensitive() {
    assert!(path_is_within(
        r"C:\Windows\Installer\x.msi",
        r"c:\windows\installer"
    ));
    assert!(path_is_within(
        r"C:\Windows\Installer",
        r"C:\Windows\Installer"
    ));
    assert!(!path_is_within(
        r"C:\Windows\InstallerOld",
        r"C:\Windows\Installer"
    ));
    assert!(!path_is_within(r"C:\Windows", r"C:\Windows\Installer"));
}

#[test]
fn path_is_within_supports_single_segment_wildcard() {
    let pattern = r"C:\Users\u\AppData\Local\Packages\*\LocalState";
    assert!(path_is_within(
        r"C:\Users\u\AppData\Local\Packages\MSTeams_x\LocalState\db",
        pattern
    ));
    assert!(!path_is_within(
        r"C:\Users\u\AppData\Local\Packages\MSTeams_x\LocalCache",
        pattern
    ));
}

#[test]
fn cloud_folders_are_detected_by_name_not_by_reparse_point() {
    for name in [
        "OneDrive",
        "OneDrive - Empresa",
        "Google Drive",
        "Meu Drive",
        "Dropbox",
        "iCloudDrive",
        "Box Drive",
    ] {
        assert!(is_cloud_folder_name(name), "{name}");
    }
    for name in ["Documents", "Menu Iniciar", "Ambiente de Rede", "Box"] {
        assert!(!is_cloud_folder_name(name), "{name}");
    }
}

#[test]
fn windows_baseline_exclusions_cover_the_skill_mandatory_list() {
    let list = ExclusionList::windows_baseline("C:", r"C:\Users\u\AppData\Local");
    for p in [
        r"C:\Windows\Installer\abc.msi",
        r"C:\Windows\WinSxS\amd64_x",
        r"C:\ProgramData\Package Cache\{guid}",
        r"C:\Program Files\WindowsApps\App",
        r"C:\pagefile.sys",
        r"C:\Users\u\AppData\Local\Packages\Spotify\LocalState",
        r"C:\Windows\System32\DriverStore\FileRepository",
        r"C:\ProgramData\Microsoft\Search\Data",
    ] {
        let hit = list.matching(p);
        assert!(hit.is_some(), "deveria excluir {p}");
        assert!(!hit.unwrap().reason.pt.is_empty());
    }
    assert!(list
        .matching(r"C:\Users\u\AppData\Local\npm-cache")
        .is_none());
    assert!(list.len() >= 8);
    assert!(!list.is_empty());
}

#[test]
fn exclusion_list_accepts_extra_entries_but_never_drops_the_baseline() {
    let list = ExclusionList::windows_baseline("C:", r"C:\L").with(
        r"D:\Backups",
        disk_cleanup_domain::LocalizedText::same("backups do usuário"),
    );
    assert_eq!(
        list.matching(r"D:\Backups\2026").unwrap().reason.pt,
        "backups do usuário"
    );
    assert!(list.matching(r"C:\Windows\Installer").is_some());
    assert_eq!(
        list.entries()
            .iter()
            .filter(|e| e.pattern == r"D:\Backups")
            .count(),
        1
    );
    assert!(ExclusionList::default().is_empty());
}

#[test]
fn toolchain_guard_blocks_target_referenced_by_env_var() {
    let guard = ToolchainGuard::new(
        vec![(
            "CUDA_PATH".into(),
            r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v11.8".into(),
        )],
        vec![],
    );
    let reason = guard.blocking_reason(
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v11.8",
        &["CUDA_PATH".into()],
    );
    assert_eq!(
        reason,
        Some(disk_cleanup_domain::BlockReason::EnvVar {
            name: "CUDA_PATH".into()
        })
    );
    // variável não monitorada pela regra não bloqueia
    assert_eq!(
        guard.blocking_reason(
            r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v11.8",
            &[]
        ),
        None
    );
}

#[test]
fn toolchain_guard_blocks_target_that_contains_a_path_entry() {
    let guard = ToolchainGuard::new(
        vec![],
        vec![r"C:\tools\cuda\v11.8\bin".into(), String::new()],
    );
    assert_eq!(
        guard.blocking_reason(r"C:\tools\cuda\v11.8", &[]),
        Some(disk_cleanup_domain::BlockReason::PathEntry {
            entry: r"C:\tools\cuda\v11.8\bin".into()
        })
    );
    assert_eq!(guard.blocking_reason(r"C:\tools\other", &[]), None);
}

/// Alvo que CONTÉM uma exclusão também conflita: remover a pasta pai apagaria
/// a pasta protegida junto.
#[test]
fn conflicting_covers_targets_inside_and_targets_containing_an_exclusion() {
    use disk_cleanup_domain::{ExclusionList, LocalizedText};
    let list = ExclusionList::default().with(r"C:\Windows\WinSxS", LocalizedText::same("winsxs"));
    assert!(list.conflicting(r"C:\Windows\WinSxS\x").is_some());
    assert!(list.conflicting(r"C:\Windows").is_some());
    assert!(list.conflicting(r"c:\windows\").is_some());
    assert!(list.conflicting(r"C:\Windows\Temp").is_none());
    assert!(list.conflicting(r"C:\Win").is_none());
}
