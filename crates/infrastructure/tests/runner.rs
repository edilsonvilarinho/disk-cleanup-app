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
    let outcome = FsActionRunner::default()
        .remove_path(cache.to_str().unwrap())
        .unwrap();
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
    let outcome = FsActionRunner::default()
        .remove_path(file.to_str().unwrap())
        .unwrap();
    assert_eq!(outcome.removed, ByteSize::from_bytes(1000));
    assert!(!file.exists());
}

#[test]
fn missing_path_is_not_found() {
    let (dir, _) = target();
    let missing = dir.path().join("nada");
    assert!(matches!(
        FsActionRunner::default().remove_path(missing.to_str().unwrap()),
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
    let outcome = FsActionRunner::default()
        .remove_path(cache.to_str().unwrap())
        .unwrap();
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
    FsActionRunner::default()
        .remove_path(cache.to_str().unwrap())
        .unwrap();
    assert!(!cache.exists());
    assert!(
        outside.join("doc.txt").exists(),
        "o destino da junção foi apagado"
    );
}

#[test]
fn runs_commands_through_the_platform_shell() {
    let runner = FsActionRunner::default();
    let ok = runner.run_command("echo disk-cleanup").unwrap();
    assert!(ok.success);
    assert_eq!(ok.code, Some(0));
    assert!(ok.output.contains("disk-cleanup"));
    let failed = runner.run_command("exit 3").unwrap();
    assert!(!failed.success);
    assert_eq!(failed.code, Some(3));
}

// ---------- Lixeira ----------

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use disk_cleanup_infrastructure::Recycler;

/// Lixeira falsa: "move" renomeando para `bin`. Recusa (como o Windows com
/// arquivo em uso) qualquer item que seja ou contenha um nome de `refuse`,
/// mas move os demais itens do mesmo lote — igual ao `IFileOperation`.
#[derive(Debug)]
struct FakeRecycler {
    bin: PathBuf,
    refuse: HashSet<String>,
    refuse_all: bool,
    calls: Mutex<Vec<usize>>,
}

impl FakeRecycler {
    fn new(bin: &Path, refuse: &[&str]) -> Self {
        fs::create_dir_all(bin).unwrap();
        Self {
            bin: bin.to_path_buf(),
            refuse: refuse.iter().map(|s| (*s).to_string()).collect(),
            refuse_all: false,
            calls: Mutex::default(),
        }
    }

    fn refused(&self, path: &Path) -> Option<String> {
        if self.refuse_all {
            return Some(format!("{}: lixeira indisponível", path.display()));
        }
        let name = path.file_name()?.to_string_lossy().to_string();
        if self.refuse.contains(&name) {
            return Some(format!("{}: em uso", path.display()));
        }
        if path.is_dir() {
            return fs::read_dir(path)
                .unwrap()
                .flatten()
                .find_map(|e| self.refused(&e.path()));
        }
        None
    }
}

impl Recycler for FakeRecycler {
    fn recycle(&self, paths: &[PathBuf]) -> Result<(), String> {
        self.calls.lock().unwrap().push(paths.len());
        let mut first = None;
        for p in paths {
            match self.refused(p) {
                Some(e) => {
                    first.get_or_insert(e);
                }
                None => {
                    let to = self.bin.join(format!(
                        "{}-{}",
                        self.calls.lock().unwrap().len(),
                        p.file_name().unwrap().to_string_lossy()
                    ));
                    fs::rename(p, to).unwrap();
                }
            }
        }
        first.map_or(Ok(()), Err)
    }
}

#[test]
fn trash_moves_the_whole_tree_in_one_call() {
    let (dir, cache) = target();
    let recycler = FakeRecycler::new(&dir.path().join("bin"), &[]);
    let runner = FsActionRunner::with_recycler(Box::new(recycler));
    let outcome = runner.trash_path(cache.to_str().unwrap()).unwrap();
    assert_eq!(outcome.removed, ByteSize::from_bytes(1500));
    assert_eq!(outcome.remaining, ByteSize::ZERO);
    assert!(outcome.errors.is_empty());
    assert!(!cache.exists());
    assert_eq!(fs::read_dir(dir.path().join("bin")).unwrap().count(), 1);
}

/// O Windows recusa a pasta inteira se um arquivo dela está em uso. O runner
/// desce só no ramo que travou, em lote por nível, e o resto vai para a Lixeira.
#[test]
fn trash_descends_only_into_the_branch_that_refused() {
    let (dir, cache) = target();
    fs::write(cache.join("sub/c.bin"), vec![0u8; 200]).unwrap();
    let recycler = FakeRecycler::new(&dir.path().join("bin"), &["b.bin"]);
    let runner = FsActionRunner::with_recycler(Box::new(recycler));
    let outcome = runner.trash_path(cache.to_str().unwrap()).unwrap();
    assert_eq!(outcome.removed, ByteSize::from_bytes(1200));
    assert_eq!(outcome.remaining, ByteSize::from_bytes(500));
    assert_eq!(outcome.errors.len(), 1);
    assert!(outcome.errors[0].contains("b.bin"), "{:?}", outcome.errors);
    assert!(!cache.join("a.bin").exists());
    assert!(!cache.join("sub/c.bin").exists());
    assert!(cache.join("sub/deep/b.bin").exists());
}

#[test]
fn trash_of_a_missing_path_is_not_found() {
    let (dir, _) = target();
    let runner =
        FsActionRunner::with_recycler(Box::new(FakeRecycler::new(&dir.path().join("bin"), &[])));
    assert!(matches!(
        runner.trash_path(dir.path().join("nada").to_str().unwrap()),
        Err(PortError::NotFound(_))
    ));
}

/// Lixeira indisponível no volume: para depois de poucos erros em vez de
/// tentar milhares de arquivos um a um.
#[test]
fn trash_gives_up_after_a_few_errors_when_the_bin_refuses_everything() {
    let (dir, cache) = target();
    for i in 0..30 {
        fs::write(cache.join(format!("f{i}.tmp")), b"x").unwrap();
    }
    let mut recycler = FakeRecycler::new(&dir.path().join("bin"), &[]);
    recycler.refuse_all = true;
    let runner = FsActionRunner::with_recycler(Box::new(recycler));
    let outcome = runner.trash_path(cache.to_str().unwrap()).unwrap();
    assert_eq!(outcome.removed, ByteSize::ZERO);
    assert_eq!(outcome.remaining, ByteSize::from_bytes(1530));
    assert_eq!(outcome.errors.len(), 5);
    assert!(outcome.errors[0].contains("lixeira indisponível"));
}

/// Alvo que é ele mesmo uma junção: sai o link, nunca o destino, e nada vai
/// para a Lixeira.
#[cfg(windows)]
#[test]
fn trash_never_follows_a_junction_root() {
    let (dir, _cache) = target();
    let outside = dir.path().join("precioso");
    fs::create_dir_all(&outside).unwrap();
    fs::write(outside.join("doc.txt"), b"nao apagar").unwrap();
    let link = dir.path().join("link");
    let status = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(&link)
        .arg(&outside)
        .output()
        .unwrap();
    assert!(status.status.success(), "mklink /J falhou");
    let runner =
        FsActionRunner::with_recycler(Box::new(FakeRecycler::new(&dir.path().join("bin"), &[])));
    runner.trash_path(link.to_str().unwrap()).unwrap();
    assert!(fs::symlink_metadata(&link).is_err());
    assert!(outside.join("doc.txt").exists());
    assert_eq!(fs::read_dir(dir.path().join("bin")).unwrap().count(), 0);
}

/// Lixeira real do sistema. Ignorado por padrão para o `cargo test` não mexer
/// na Lixeira de quem roda: `cargo test -p disk-cleanup-infrastructure -- --ignored`.
#[test]
#[ignore = "usa a Lixeira real do sistema"]
fn system_recycler_moves_to_the_real_trash() {
    let (_dir, cache) = target();
    let outcome = FsActionRunner::default()
        .trash_path(cache.to_str().unwrap())
        .unwrap();
    assert_eq!(outcome.removed, ByteSize::from_bytes(1500));
    assert!(!cache.exists());
}
