use std::fs;

use disk_cleanup_application::{
    Environment, FileWalker, PathInspector, PortError, ScanProgress, VolumeInfo,
};
use disk_cleanup_domain::{path_components, ByteSize};
use disk_cleanup_infrastructure::{
    allocated_size, exclusions_for, JwalkFileWalker, SilentProgress, SnapshotEnvironment,
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
        assert_eq!(
            SysinfoVolumeInfo.usage(drive).unwrap().total(),
            usage.total()
        );
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
fn exclusions_follow_the_platform_chosen_at_runtime() {
    let windows = SnapshotEnvironment::from_pairs(vec![
        ("SystemDrive".into(), "D:".into()),
        ("LOCALAPPDATA".into(), r"D:\Users\u\AppData\Local".into()),
    ]);
    assert!(exclusions_for("windows", &windows)
        .matching(r"D:\Windows\Installer\x")
        .is_some());
    let bare = SnapshotEnvironment::from_pairs(vec![]);
    assert!(exclusions_for("windows", &bare)
        .matching(r"C:\Windows\WinSxS")
        .is_some());

    let unix = SnapshotEnvironment::from_pairs(vec![("HOME".into(), "/home/u".into())]);
    assert!(exclusions_for("linux", &unix)
        .matching("/home/u/.ssh/id_rsa")
        .is_some());
    assert!(exclusions_for("linux", &bare).matching("/proc/1").is_some());
    let mac = SnapshotEnvironment::from_pairs(vec![("HOME".into(), "/Users/u".into())]);
    assert!(exclusions_for("macos", &mac)
        .matching("/Users/u/Library/Keychains/x")
        .is_some());
    assert!(exclusions_for("freebsd", &unix).is_empty());
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

// ---------- Projetos ----------

mod projects {
    use std::fs;
    use std::path::Path;
    use std::time::{Duration, SystemTime};

    use disk_cleanup_application::{ProjectFinder, ProjectProfile};
    use disk_cleanup_domain::LocalizedText;
    use disk_cleanup_infrastructure::FsProjectFinder;

    const DAY: Duration = Duration::from_secs(86_400);

    fn profile(id: &str, markers: &[&str], artifacts: &[&str]) -> ProjectProfile {
        ProjectProfile {
            id: id.into(),
            label: LocalizedText::same(id),
            markers: markers.iter().map(|s| (*s).to_string()).collect(),
            artifacts: artifacts.iter().map(|s| (*s).to_string()).collect(),
            note: LocalizedText::default(),
        }
    }

    fn profiles() -> Vec<ProjectProfile> {
        vec![
            profile("node", &["package.json"], &["node_modules", ".next"]),
            profile("rust", &["Cargo.toml"], &["target"]),
        ]
    }

    fn touch(path: &Path, age_days: u32, now: SystemTime) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, b"x").unwrap();
        let f = fs::File::options().write(true).open(path).unwrap();
        f.set_modified(now - DAY * age_days).unwrap();
    }

    fn s(p: &Path) -> String {
        p.to_string_lossy().into_owned()
    }

    #[test]
    fn finds_artifacts_by_marker_measures_idle_days_and_never_descends_into_artifacts() {
        let dir = tempfile::tempdir().unwrap();
        let now = SystemTime::now();
        let root = dir.path().join("dev");
        // projeto velho: marcador e fonte com 400+ dias; artefato recente não conta
        let loja = root.join("loja");
        touch(&loja.join("package.json"), 400, now);
        touch(&loja.join("src").join("app.ts"), 410, now);
        touch(
            &loja.join("node_modules").join("react").join("index.js"),
            1,
            now,
        );
        // pacote dentro do node_modules com marcador: nunca é visitado
        touch(
            &loja.join("node_modules").join("react").join("package.json"),
            1,
            now,
        );
        fs::create_dir_all(loja.join("node_modules").join("react").join("node_modules")).unwrap();
        // monorepo: rust na raiz, node em subpasta
        let mono = root.join("grupo").join("mono");
        touch(&mono.join("Cargo.toml"), 3, now);
        fs::create_dir_all(mono.join("target").join("debug")).unwrap();
        touch(&mono.join("web").join("package.json"), 30, now);
        fs::create_dir_all(mono.join("web").join(".next")).unwrap();
        // marcador sem artefato e artefato sem marcador: nada
        touch(&root.join("sem-artefato").join("package.json"), 5, now);
        fs::create_dir_all(root.join("solto").join("node_modules").join("x")).unwrap();
        // pasta oculta não é varrida
        touch(&root.join(".cache").join("p").join("package.json"), 5, now);
        fs::create_dir_all(root.join(".cache").join("p").join("node_modules")).unwrap();

        let finder = FsProjectFinder::at(now, 6);
        let mut found = finder.find(&[s(&root), s(&dir.path().join("nao-existe"))], &profiles());
        found.sort_by(|a, b| a.path.cmp(&b.path));
        let got: Vec<_> = found
            .iter()
            .map(|f| {
                let rel = Path::new(&f.path).strip_prefix(&root).unwrap();
                (
                    f.profile.as_str(),
                    rel.to_string_lossy().replace('\\', "/"),
                    f.idle_days,
                )
            })
            .collect();
        assert_eq!(
            got,
            vec![
                ("rust", "grupo/mono/target".to_string(), Some(3)),
                ("node", "grupo/mono/web/.next".to_string(), Some(30)),
                ("node", "loja/node_modules".to_string(), Some(400)),
            ]
        );
        assert_eq!(Path::new(&found[2].project), loja.as_path());
    }

    #[test]
    fn respects_max_depth_and_a_project_without_files_has_no_idle_days() {
        let dir = tempfile::tempdir().unwrap();
        let now = SystemTime::now();
        let deep = dir.path().join("a").join("b").join("c").join("d");
        touch(&deep.join("Cargo.toml"), 2, now);
        fs::create_dir_all(deep.join("target")).unwrap();
        let roots = [s(dir.path())];
        assert!(FsProjectFinder::at(now, 3)
            .find(&roots, &profiles())
            .is_empty());
        assert_eq!(
            FsProjectFinder::at(now, 4).find(&roots, &profiles()).len(),
            1
        );
        // marcador que é diretório não é arquivo de atividade: idade desconhecida
        let odd = dir.path().join("odd");
        fs::create_dir_all(odd.join("package.json")).unwrap();
        fs::create_dir_all(odd.join("node_modules")).unwrap();
        let found = FsProjectFinder::at(now, 2).find(&[s(&odd)], &profiles());
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].idle_days, None);
        assert!(FsProjectFinder::default().find(&roots, &[]).is_empty());
    }

    /// Junção para fora da pasta de projetos: nunca seguida.
    #[cfg(windows)]
    #[test]
    fn never_follows_junctions() {
        let dir = tempfile::tempdir().unwrap();
        let now = SystemTime::now();
        let outside = dir.path().join("fora");
        touch(&outside.join("package.json"), 1, now);
        fs::create_dir_all(outside.join("node_modules")).unwrap();
        let root = dir.path().join("dev");
        fs::create_dir_all(&root).unwrap();
        let ok = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(root.join("link"))
            .arg(&outside)
            .output()
            .unwrap();
        assert!(ok.status.success());
        assert!(FsProjectFinder::at(now, 6)
            .find(&[s(&root)], &profiles())
            .is_empty());
    }
}
