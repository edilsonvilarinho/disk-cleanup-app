use std::cell::RefCell;
use std::collections::HashMap;

use disk_cleanup_application::{
    ActionRunner, CommandOutcome, FileRecord, FileWalker, FoundArtifact, PathInspector, PortError,
    ProjectFinder, ProjectProfile, RemovalOutcome, VolumeInfo, WalkStats,
};
use disk_cleanup_cli::{run, Ports, TextFiles};
use disk_cleanup_domain::{path_components, ByteSize, ExclusionList, VolumeUsage};
use disk_cleanup_infrastructure::{SkillPlanJsonCodec, SnapshotEnvironment, TomlCatalogRepository};

const GIB: u64 = 1 << 30;

struct Walker;
impl FileWalker for Walker {
    fn walk(&self, _: &str, sink: &mut dyn FnMut(FileRecord)) -> Result<WalkStats, PortError> {
        for (p, size) in [
            (r"C:\Users\u\Downloads\a.iso", 2 * GIB),
            (r"C:\Windows\x", GIB),
        ] {
            sink(FileRecord {
                components: path_components(p),
                logical: ByteSize::from_bytes(size),
                allocated: ByteSize::from_bytes(size),
                modified: None,
            });
        }
        Ok(WalkStats {
            files: 2,
            unreadable: 0,
        })
    }
}

struct Volume;
impl VolumeInfo for Volume {
    fn usage(&self, _: &str) -> Result<VolumeUsage, PortError> {
        Ok(VolumeUsage::new(
            ByteSize::from_bytes(100 * GIB),
            ByteSize::from_bytes(10 * GIB),
        )
        .unwrap())
    }
}

struct Inspector;
impl PathInspector for Inspector {
    fn exists(&self, _: &str) -> bool {
        true
    }
    fn size_of(&self, _: &str) -> Result<ByteSize, PortError> {
        Ok(ByteSize::from_bytes(GIB))
    }
}

struct Finder;
impl ProjectFinder for Finder {
    fn find(&self, roots: &[String], _: &[ProjectProfile]) -> Vec<FoundArtifact> {
        roots
            .iter()
            .flat_map(|r| {
                [("velho", 400), ("novo", 3)].map(|(name, idle)| FoundArtifact {
                    profile: "node".into(),
                    project: format!(r"{r}\{name}"),
                    path: format!(r"{r}\{name}\node_modules"),
                    idle_days: Some(idle),
                })
            })
            .collect()
    }
}

#[derive(Default)]
struct Runner(RefCell<Vec<String>>);
impl ActionRunner for Runner {
    fn remove_path(&self, path: &str) -> Result<RemovalOutcome, PortError> {
        self.0.borrow_mut().push(format!("rm {path}"));
        Ok(RemovalOutcome {
            removed: ByteSize::from_bytes(GIB),
            remaining: ByteSize::ZERO,
            errors: vec![],
        })
    }
    fn trash_path(&self, path: &str) -> Result<RemovalOutcome, PortError> {
        self.0.borrow_mut().push(format!("trash {path}"));
        Ok(RemovalOutcome {
            removed: ByteSize::from_bytes(GIB),
            remaining: ByteSize::ZERO,
            errors: vec![],
        })
    }
    fn run_command(&self, command: &str) -> Result<CommandOutcome, PortError> {
        self.0.borrow_mut().push(format!("cmd {command}"));
        Ok(CommandOutcome {
            success: false,
            code: Some(1),
            output: "falhou".into(),
        })
    }
}

#[derive(Default)]
struct Files(RefCell<HashMap<String, String>>);
impl TextFiles for Files {
    fn read(&self, path: &str) -> Result<String, String> {
        self.0
            .borrow()
            .get(path)
            .cloned()
            .ok_or_else(|| format!("{path}: não existe"))
    }
    fn write(&self, path: &str, text: &str) -> Result<(), String> {
        if path.starts_with("Z:") {
            return Err(format!("{path}: sem permissão"));
        }
        self.0.borrow_mut().insert(path.into(), text.into());
        Ok(())
    }
}

const CATALOG: &str = r#"
[[rule]]
id = "npm-cache"
label = "npm cache"
tier = "A"
risk = "none"
kind = "command"
command = "npm cache clean --force"
measure = '%LOCALAPPDATA%\npm-cache'

[[rule]]
id = "gradle"
label = "Gradle"
tier = "C"
risk = "redownload"
kind = "path"
path = '%USERPROFILE%\.gradle\caches'

[[project]]
id = "node"
label = "Node.js"
markers = ["package.json"]
artifacts = ["node_modules"]
note = "npm install recria"
note_en = "npm install recreates it"
"#;

struct World {
    env: SnapshotEnvironment,
    catalog: TomlCatalogRepository,
    runner: Runner,
    files: Files,
}

impl World {
    fn new() -> Self {
        Self {
            env: SnapshotEnvironment::from_pairs(vec![
                ("SystemDrive".into(), "C:".into()),
                ("USERPROFILE".into(), r"C:\Users\u".into()),
                ("LOCALAPPDATA".into(), r"C:\Users\u\AppData\Local".into()),
            ]),
            catalog: TomlCatalogRepository::from_text(CATALOG),
            runner: Runner::default(),
            files: Files::default(),
        }
    }

    fn run(&self, args: &[&str]) -> (i32, String) {
        let ports = Ports {
            env: &self.env,
            walker: &Walker,
            volumes: &Volume,
            inspector: &Inspector,
            catalog: &self.catalog,
            baseline: ExclusionList::default(),
            finder: &Finder,
            runner: &self.runner,
            codec: &SkillPlanJsonCodec,
            files: &self.files,
            windows: true,
        };
        assert_eq!(format!("{ports:?}"), "Ports");
        let mut out = Vec::new();
        let args: Vec<String> = args.iter().map(|s| (*s).to_string()).collect();
        let code = run(&args, &ports, &mut out);
        (code, String::from_utf8(out).unwrap())
    }
}

#[test]
fn usage_errors_exit_with_two_and_show_the_usage() {
    let w = World::new();
    for args in [
        &[][..],
        &["limpar"],
        &["survey", "--nada"],
        &["survey", "--depth"],
        &["survey", "--depth", "3"],
    ] {
        let (code, out) = w.run(args);
        assert_eq!(code, 2, "{args:?}: {out}");
    }
    assert!(w.run(&[]).1.contains("uso:"));
    assert!(w.run(&["survey", "--depth", "3"]).1.contains("1 ou 2"));
}

#[test]
fn survey_is_read_only_and_reports_the_volume() {
    let w = World::new();
    let (code, out) = w.run(&["survey", "--depth", "1"]);
    assert_eq!(code, 0, "{out}");
    assert!(
        out.starts_with(r"C:\: 90,0 GB usados · 10,0 GB livres · 2 arquivos"),
        "{out}"
    );
    assert!(out.contains("1 arquivos grandes no perfil"));
    assert!(w.runner.0.borrow().is_empty());
    let (_, linux) = World::new().run(&["survey", "--root", "/"]);
    assert!(linux.starts_with("/: "), "{linux}");
}

#[test]
fn classify_lists_by_tier_and_writes_the_plan_with_the_default_selection() {
    let w = World::new();
    let (code, out) = w.run(&["classify", "--project-root", r"D:\dev"]);
    assert_eq!(code, 0, "{out}");
    assert!(out.contains("A Cache regenerável"), "{out}");
    assert!(out.contains(r"project:D:\dev\velho\node_modules"));
    assert!(out.contains("somente leitura"));

    let (code, out) = w.run(&[
        "classify",
        "--project-root",
        r"D:\dev",
        "--out",
        "plan.json",
    ]);
    assert_eq!(code, 0, "{out}");
    assert!(out.contains("plan.json gravado: 3 itens"), "{out}");
    let json = w.files.read("plan.json").unwrap();
    // projeto com atividade recente fica fora do plano
    assert!(json.contains("velho") && !json.contains("novo"), "{json}");

    let (code, out) = w.run(&["classify", "--out", r"Z:\plan.json"]);
    assert_eq!((code, out.contains("sem permissão")), (1, true), "{out}");
}

#[test]
fn execute_requires_explicit_approval_and_confirmation() {
    let w = World::new();
    w.run(&["classify", "--out", "plan.json"]);
    let (code, out) = w.run(&["execute", "--plan", "plan.json"]);
    assert_eq!(code, 2);
    assert!(out.contains("plano não aprovado"), "{out}");
    let (code, out) = w.run(&["execute", "--plan", "plan.json", "--approve", "A"]);
    assert_eq!(code, 2);
    assert!(out.contains("--yes"), "{out}");
    let (code, _) = w.run(&["execute", "--approve", "A", "--yes"]);
    assert_eq!(code, 2);
    let (code, out) = w.run(&[
        "execute",
        "--plan",
        "nao-existe.json",
        "--approve",
        "A",
        "--yes",
    ]);
    assert_eq!((code, out.contains("não existe")), (1, true));
    let (code, out) = w.run(&["execute", "--plan", "plan.json", "--approve", "D", "--yes"]);
    assert_eq!(code, 1, "{out}");
    let (code, _) = w.run(&["execute", "--plan", "plan.json", "--approve", "Z", "--yes"]);
    assert_eq!(code, 2);
    for bad in ["A", "A=lixo", "Q=trash"] {
        let (code, _) = w.run(&[
            "execute",
            "--plan",
            "plan.json",
            "--approve",
            "A",
            "--disposal",
            bad,
            "--yes",
        ]);
        assert_eq!(code, 2, "{bad}");
    }
    assert!(w.runner.0.borrow().is_empty());
}

#[test]
fn dry_run_lists_without_touching_and_execute_respects_the_disposal() {
    let w = World::new();
    w.run(&["classify", "--out", "plan.json"]);
    let (code, out) = w.run(&[
        "execute",
        "--plan",
        "plan.json",
        "--approve",
        "A,C",
        "--yes",
        "--dry-run",
    ]);
    assert_eq!(code, 0, "{out}");
    assert!(
        out.contains("tier A · dry-run · destino permanent"),
        "{out}"
    );
    assert!(out.contains("tier C · dry-run · destino trash"), "{out}");
    assert!(w.runner.0.borrow().is_empty());

    let (code, out) = w.run(&[
        "execute",
        "--plan",
        "plan.json",
        "--approve",
        "A,C",
        "--disposal",
        "C=permanent",
        "--yes",
    ]);
    assert_eq!(code, 0, "{out}");
    let calls = w.runner.0.borrow().clone();
    assert_eq!(
        calls,
        vec![
            "cmd npm cache clean --force".to_string(),
            r"rm C:\Users\u\.gradle\caches".to_string()
        ]
    );
    assert!(out.contains("failed"), "{out}");
    assert!(
        out.contains("tier C: +0,0 GB medidos (1,0 GB estimados) · 0,0 GB na Lixeira"),
        "{out}"
    );

    let w = World::new();
    w.run(&["classify", "--out", "plan.json"]);
    let (_, out) = w.run(&["execute", "--plan", "plan.json", "--approve", "C", "--yes"]);
    assert!(out.contains("Lixeira 1,0 GB"), "{out}");
    assert_eq!(w.runner.0.borrow()[0], r"trash C:\Users\u\.gradle\caches");
}
