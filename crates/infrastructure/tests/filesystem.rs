use std::fs;

use disk_cleanup_application::{
    Environment, FileWalker, PathInspector, PortError, ScanProgress, VolumeInfo,
};
use disk_cleanup_domain::{path_components, ByteSize};
use disk_cleanup_infrastructure::{
    allocated_size, platform_exclusions, JwalkFileWalker, SilentProgress, SnapshotEnvironment,
    SysinfoVolumeInfo, WalkerPathInspector,
};

fn tree() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir_all(dir.path().join("cache/sub")).unwrap();
    fs::write(dir.path().join("cache/a.bin"), vec![0u8; 1000]).unwrap();
    fs::write(dir.path().join("cache/sub/b.bin"), vec![0u8; 3000]).unwrap();
    fs::write(dir.path().join("root.txt"), b"12345").unwrap();
    fs::create_dir_all(dir.path().join("empty")).unwrap();
    dir
}

#[test]
fn walker_visits_every_file_with_logical_and_allocated_size() {
    let dir = tree();
    let mut seen = Vec::new();
    let stats = JwalkFileWalker
        .walk(dir.path().to_str().unwrap(), &mut |f| seen.push(f))
        .unwrap();
    assert_eq!(stats.files, 3);
    assert_eq!(stats.unreadable, 0);
    let total: u64 = seen.iter().map(|f| f.logical.bytes()).sum();
    assert_eq!(total, 4005);
    let root_len = path_components(dir.path().to_str().unwrap()).len();
    let b = seen
        .iter()
        .find(|f| f.components.last().unwrap() == "b.bin")
        .unwrap();
    assert_eq!(b.components[root_len..], ["cache", "sub", "b.bin"]);
    // arquivo comum, não comprimido nem esparso: alocado ≥ lógico
    assert!(b.allocated.bytes() >= 3000);
}

#[test]
fn walker_reports_missing_root_as_not_found() {
    let dir = tree();
    let missing = dir.path().join("nao-existe");
    let err = JwalkFileWalker
        .walk(missing.to_str().unwrap(), &mut |_| {})
        .unwrap_err();
    assert!(matches!(err, PortError::NotFound(_)));
}

#[test]
fn allocated_size_falls_back_to_logical_when_the_os_query_fails() {
    let dir = tree();
    let file = dir.path().join("root.txt");
    let meta = fs::metadata(&file).unwrap();
    assert!(allocated_size(&file, &meta) >= 5);
    // Windows: arquivo apagado depois de ler os metadados → a consulta ao SO
    // falha e o valor cai para o tamanho lógico. Em Unix o valor vem dos
    // próprios metadados (blocks × 512), sem nova consulta.
    fs::remove_file(&file).unwrap();
    if cfg!(windows) {
        assert_eq!(allocated_size(&file, &meta), 5);
    }
}

#[test]
fn inspector_measures_directories_and_single_files() {
    let dir = tree();
    let inspector = WalkerPathInspector::new(JwalkFileWalker);
    let cache = dir.path().join("cache");
    assert!(inspector.exists(cache.to_str().unwrap()));
    assert!(!inspector.exists(dir.path().join("x").to_str().unwrap()));
    assert_eq!(
        inspector.size_of(cache.to_str().unwrap()),
        Ok(ByteSize::from_bytes(4000))
    );
    assert_eq!(
        inspector.size_of(dir.path().join("root.txt").to_str().unwrap()),
        Ok(ByteSize::from_bytes(5))
    );
    assert_eq!(
        inspector.size_of(dir.path().join("empty").to_str().unwrap()),
        Ok(ByteSize::ZERO)
    );
    assert!(matches!(
        inspector.size_of(dir.path().join("x").to_str().unwrap()),
        Err(PortError::NotFound(_))
    ));
}

#[test]
fn volume_info_resolves_the_volume_that_contains_a_path() {
    let dir = tree();
    let usage = SysinfoVolumeInfo
        .usage(dir.path().to_str().unwrap())
        .unwrap();
    assert!(usage.total() > ByteSize::ZERO);
    assert!(usage.free() <= usage.total());
    // Relativo nunca resolve (no Linux, `/` casaria com qualquer texto).
    assert!(matches!(
        SysinfoVolumeInfo.usage("relativo/pasta"),
        Err(PortError::NotFound(_))
    ));
    if cfg!(windows) {
        assert!(matches!(
            SysinfoVolumeInfo.usage("Q:\\nada\\aqui"),
            Err(PortError::NotFound(_))
        ));
        // Volume como o plano guarda (`C:`) é a raiz da unidade, não "relativo".
        let drive = &dir.path().to_str().unwrap()[..2];
        assert_eq!(SysinfoVolumeInfo.usage(drive).unwrap().total(), usage.total());
    }
}

#[test]
fn snapshot_environment_reads_vars_case_insensitively_and_splits_path() {
    let sep = if cfg!(windows) { ';' } else { ':' };
    let env = SnapshotEnvironment::from_pairs(vec![
        ("LocalAppData".into(), "L".into()),
        ("PATH".into(), format!("a{sep}{sep}b")),
    ]);
    assert_eq!(env.var("LOCALAPPDATA").as_deref(), Some("L"));
    assert_eq!(env.var("NADA"), None);
    assert_eq!(env.path_entries(), ["a", "b"]);
    assert_eq!(env.vars().len(), 2);
    assert!(SnapshotEnvironment::from_pairs(vec![])
        .path_entries()
        .is_empty());

    let process = SnapshotEnvironment::from_process();
    assert!(process.var("PATH").is_some());
}

#[test]
fn platform_exclusions_protect_system_paths_on_this_os() {
    let env = SnapshotEnvironment::from_pairs(vec![
        ("SystemDrive".into(), "C:".into()),
        ("LOCALAPPDATA".into(), r"C:\Users\u\AppData\Local".into()),
    ]);
    let list = platform_exclusions(&env);
    if cfg!(windows) {
        assert!(list.matching(r"C:\Windows\Installer\x").is_some());
        assert!(
            platform_exclusions(&SnapshotEnvironment::from_pairs(vec![]))
                .matching(r"C:\Windows\WinSxS")
                .is_some()
        );
    } else {
        assert!(list.is_empty());
    }
}

#[test]
fn silent_progress_accepts_updates() {
    SilentProgress.scanned(10, ByteSize::from_bytes(1));
}

/// Diretório sem permissão de listagem conta como "sem acesso" (o jwalk
/// reporta a falha em `read_children_error`, não como item de erro).
#[cfg(windows)]
#[test]
fn walker_counts_directories_it_cannot_read() {
    use std::process::Command;
    let dir = tree();
    let locked = dir.path().join("locked");
    fs::create_dir_all(&locked).unwrap();
    fs::write(locked.join("secret.bin"), b"x").unwrap();
    let user = std::env::var("USERNAME").unwrap();
    let icacls = |args: &[&str]| {
        Command::new("icacls")
            .arg(&locked)
            .args(args)
            .output()
            .unwrap()
    };
    assert!(icacls(&["/deny", &format!("{user}:(RD)")]).status.success());

    let mut files = 0;
    let stats = JwalkFileWalker.walk(dir.path().to_str().unwrap(), &mut |_| files += 1);

    icacls(&["/remove:d", &user]); // devolve o acesso antes de qualquer assert
    let stats = stats.unwrap();
    assert_eq!(stats.unreadable, 1);
    assert_eq!(files, 3);
}
