use std::fs;

use disk_cleanup_application::{ActionRunner, PortError};
use disk_cleanup_domain::ByteSize;
use disk_cleanup_infrastructure::FsActionRunner;

fn target() -> (tempfile::TempDir, std::path::PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let cache = dir.path().join("cache");
    fs::create_dir_all(cache.join("sub/deep")).unwrap();
    fs::write(cache.join("a.bin"), vec![0u8; 1000]).unwrap();
    fs::write(cache.join("sub/deep/b.bin"), vec![0u8; 500]).unwrap();
    (dir, cache)
}

#[test]
fn removes_a_whole_tree_and_reports_what_was_freed() {
    let (_dir, cache) = target();
    let outcome = FsActionRunner.remove_path(cache.to_str().unwrap()).unwrap();
    assert_eq!(outcome.removed, ByteSize::from_bytes(1500));
    assert_eq!(outcome.remaining, ByteSize::ZERO);
    assert!(outcome.errors.is_empty());
    assert!(!cache.exists());
}

#[test]
fn removes_a_single_file_including_read_only_ones() {
    let (_dir, cache) = target();
    let file = cache.join("a.bin");
    let mut perms = fs::metadata(&file).unwrap().permissions();
    perms.set_readonly(true);
    fs::set_permissions(&file, perms).unwrap();
    let outcome = FsActionRunner.remove_path(file.to_str().unwrap()).unwrap();
    assert_eq!(outcome.removed, ByteSize::from_bytes(1000));
    assert!(!file.exists());
}

#[test]
fn missing_path_is_not_found() {
    let (dir, _) = target();
    let missing = dir.path().join("nada");
    assert!(matches!(
        FsActionRunner.remove_path(missing.to_str().unwrap()),
        Err(PortError::NotFound(_))
    ));
}

/// Arquivo aberto sem compartilhamento (como o DXCache pelo driver): o resto sai,
/// ele fica e a remoção vira parcial — sem abortar.
#[cfg(windows)]
#[test]
fn locked_file_makes_the_removal_partial() {
    use std::os::windows::fs::OpenOptionsExt;
    let (_dir, cache) = target();
    let locked = cache.join("sub/deep/b.bin");
    let handle = fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(&locked)
        .unwrap();
    let outcome = FsActionRunner.remove_path(cache.to_str().unwrap()).unwrap();
    drop(handle);
    assert_eq!(outcome.removed, ByteSize::from_bytes(1000));
    assert_eq!(outcome.remaining, ByteSize::from_bytes(500));
    assert_eq!(outcome.errors.len(), 1);
    assert!(outcome.errors[0].contains("b.bin"));
    assert!(!cache.join("a.bin").exists());
}

/// Junção dentro do alvo apontando para fora: a junção sai, o destino fica.
#[cfg(windows)]
#[test]
fn never_follows_junctions_into_their_target() {
    let (dir, cache) = target();
    let outside = dir.path().join("precioso");
    fs::create_dir_all(&outside).unwrap();
    fs::write(outside.join("doc.txt"), b"nao apagar").unwrap();
    let link = cache.join("link");
    let status = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(&link)
        .arg(&outside)
        .output()
        .unwrap();
    assert!(status.status.success(), "mklink /J falhou");
    FsActionRunner.remove_path(cache.to_str().unwrap()).unwrap();
    assert!(!cache.exists());
    assert!(
        outside.join("doc.txt").exists(),
        "o destino da junção foi apagado"
    );
}

#[test]
fn runs_commands_through_the_platform_shell() {
    let runner = FsActionRunner;
    let ok = runner.run_command("echo disk-cleanup").unwrap();
    assert!(ok.success);
    assert_eq!(ok.code, Some(0));
    assert!(ok.output.contains("disk-cleanup"));
    let failed = runner.run_command("exit 3").unwrap();
    assert!(!failed.success);
    assert_eq!(failed.code, Some(3));
}
