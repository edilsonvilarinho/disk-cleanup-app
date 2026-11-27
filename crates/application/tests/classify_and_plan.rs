mod support;

use disk_cleanup_application::{
    expand_template, export_plan, AppError, Catalog, CatalogExclusion, CatalogRule,
    ClassifyService, PortError, RuleTarget, SkipReason,
};
use disk_cleanup_domain::{
    Action, Availability, BlockReason, ExclusionList, LocalizedText, Plan, Risk, Tier,
};
use support::{FakeCatalog, FakeCodec, FakeEnv, FakeInspector};

fn rule(id: &str, tier: Tier, target: RuleTarget) -> CatalogRule {
    CatalogRule {
        id: id.into(),
        label: LocalizedText::new(&format!("rótulo {id}"), &format!("label {id}")),
        tier,
        risk: Risk::None,
        note: LocalizedText::new(&format!("nota {id}"), &format!("note {id}")),
        target,
        watch_env: vec![],
    }
}

fn path(p: &str) -> RuleTarget {
    RuleTarget::Path { path: p.into() }
}

fn env() -> FakeEnv {
    let mut env = FakeEnv::with(&[
        ("LOCALAPPDATA", r"C:\Users\u\AppData\Local"),
        ("USERPROFILE", r"C:\Users\u"),
        ("CUDA_PATH", r"C:\cuda\v11.8"),
        ("HOME", "/home/u"),
    ]);
    env.path = vec![r"C:\gradle\bin".into()];
    env
}

#[test]
fn expand_template_resolves_windows_unix_and_home_forms() {
    let env = env();
    assert_eq!(
        expand_template(r"%LOCALAPPDATA%\npm-cache", &env),
        Ok(r"C:\Users\u\AppData\Local\npm-cache".into())
    );
    assert_eq!(
        expand_template("${HOME}/.cache", &env),
        Ok("/home/u/.cache".into())
    );
    assert_eq!(expand_template("~/.m2", &env), Ok("/home/u/.m2".into()));
    assert_eq!(expand_template(r"C:\fixo", &env), Ok(r"C:\fixo".into()));
    assert_eq!(
        expand_template("%NAO_EXISTE%\\x", &env),
        Err("NAO_EXISTE".into())
    );
    assert_eq!(expand_template("${NAO}/x", &env), Err("NAO".into()));
    assert_eq!(expand_template("100%", &env), Ok("100%".into()));
    assert_eq!(expand_template("${aberto", &env), Ok("${aberto".into()));

    let windows_only = FakeEnv::with(&[("USERPROFILE", r"C:\Users\w")]);
    assert_eq!(
        expand_template("~", &windows_only),
        Ok(r"C:\Users\w".into())
    );
    assert_eq!(
        expand_template("~/x", &FakeEnv::default()),
        Err("HOME".into())
    );
}

fn catalog() -> Catalog {
    let mut cuda = rule("cuda", Tier::C, path(r"C:\cuda\v11.8"));
    cuda.watch_env = vec!["CUDA_PATH".into()];
    Catalog {
        projects: Vec::new(),
        project_roots: Vec::new(),
        rules: vec![
            rule(
                "npm",
                Tier::A,
                RuleTarget::Command {
                    command: "npm cache clean --force".into(),
                    measure: r"%LOCALAPPDATA%\npm-cache".into(),
                },
            ),
            rule("pip", Tier::A, path(r"%LOCALAPPDATA%\pip\cache")),
            rule("ausente", Tier::A, path(r"%LOCALAPPDATA%\nada")),
            rule("vazio", Tier::A, path(r"%LOCALAPPDATA%\vazio")),
            rule("semvar", Tier::C, path(r"%ANDROID_HOME%\ndk")),
            rule("gradle", Tier::C, path(r"C:\gradle")),
            cuda,
            rule("installer", Tier::A, path(r"C:\Windows\Installer")),
            rule("backup", Tier::C, path(r"D:\Backups\x")),
            rule("quebrado", Tier::C, path(r"C:\quebrado")),
        ],
        exclusions: vec![CatalogExclusion {
            pattern: r"D:\Backups".into(),
            reason: LocalizedText::same("backup"),
        }],
    }
}

fn inspector() -> FakeInspector {
    let mut i = FakeInspector::with(&[
        (r"C:\Users\u\AppData\Local\npm-cache", 600),
        (r"C:\Users\u\AppData\Local\pip\cache", 300),
        (r"C:\Users\u\AppData\Local\vazio", 0),
        (r"C:\gradle", 500),
        (r"C:\cuda\v11.8", 700),
        (r"C:\Windows\Installer", 900),
        (r"D:\Backups\x", 100),
    ]);
    i.sizes.insert(
        r"c:\quebrado".into(),
        Err(PortError::Io("acesso negado".into())),
    );
    i
}

#[test]
fn classification_builds_candidates_and_explains_every_skipped_rule() {
    let baseline = ExclusionList::windows_baseline("C:", r"C:\Users\u\AppData\Local");
    let report = ClassifyService::new(&FakeCatalog(Ok(catalog())), &env(), &inspector())
        .run(baseline, &[])
        .unwrap();

    let ids: Vec<_> = report.candidates.iter().map(|c| c.id.as_str()).collect();
    assert_eq!(ids, ["npm", "pip", "gradle", "cuda"]);

    let npm = &report.candidates[0];
    assert_eq!(
        npm.action,
        Action::Command {
            command: "npm cache clean --force".into()
        }
    );
    assert_eq!(npm.size.bytes(), 600);
    assert_eq!(npm.label, LocalizedText::new("rótulo npm", "label npm"));
    assert_eq!(npm.note, LocalizedText::new("nota npm", "note npm"));
    assert_eq!(
        report.candidates[1].action,
        Action::RemovePath {
            path: r"C:\Users\u\AppData\Local\pip\cache".into()
        }
    );

    // PATH contém C:\gradle\bin → bloqueado; CUDA_PATH monitorada → bloqueado
    assert_eq!(
        report.candidates[2].availability,
        Availability::Blocked {
            reason: BlockReason::PathEntry {
                entry: r"C:\gradle\bin".into()
            }
        }
    );
    assert!(
        matches!(&report.candidates[3].availability, Availability::Blocked { reason: BlockReason::EnvVar { name } } if name == "CUDA_PATH")
    );

    let skipped: Vec<_> = report
        .skipped
        .iter()
        .map(|s| (s.id.as_str(), s.reason.clone()))
        .collect();
    assert_eq!(
        skipped,
        vec![
            (
                "ausente",
                SkipReason::NotFound(r"C:\Users\u\AppData\Local\nada".into())
            ),
            ("vazio", SkipReason::Empty),
            (
                "semvar",
                SkipReason::UnresolvedVariable("ANDROID_HOME".into())
            ),
            (
                "installer",
                SkipReason::Excluded(LocalizedText::new(
                    "cache do MSI; sem ele a desinstalação quebra",
                    "MSI cache; without it uninstalling breaks"
                ))
            ),
            (
                "backup",
                SkipReason::Excluded(LocalizedText::same("backup"))
            ),
            (
                "quebrado",
                SkipReason::Unmeasurable("erro de E/S: acesso negado".into())
            ),
        ]
    );
    assert!(report.exclusions.matching(r"D:\Backups\y").is_some());
    assert_eq!(report.selectable_total().bytes(), 900);
}

#[test]
fn classification_propagates_catalog_failure() {
    let err = ClassifyService::new(
        &FakeCatalog(Err(PortError::InvalidData("toml".into()))),
        &env(),
        &inspector(),
    )
    .run(ExclusionList::default(), &[])
    .unwrap_err();
    assert_eq!(err, AppError::Port(PortError::InvalidData("toml".into())));
}

#[test]
fn skip_reasons_have_messages() {
    for r in [
        SkipReason::NotFound("p".into()),
        SkipReason::Empty,
        SkipReason::UnresolvedVariable("V".into()),
        SkipReason::Excluded(LocalizedText::same("e")),
        SkipReason::Unmeasurable("u".into()),
    ] {
        assert!(!r.to_string().is_empty());
    }
}

#[test]
fn export_plan_delegates_to_codec_and_maps_errors() {
    let report = ClassifyService::new(&FakeCatalog(Ok(catalog())), &env(), &inspector())
        .run(ExclusionList::default(), &[])
        .unwrap();
    let plan = Plan::from_selection(
        "C:",
        &report.candidates,
        &["npm", "pip"],
        &report.exclusions,
    )
    .unwrap();
    assert_eq!(export_plan(&plan, &FakeCodec), Ok("C::2".into()));

    let err: AppError = disk_cleanup_domain::PlanError::Empty.into();
    assert!(matches!(err, AppError::Plan(_)));
    let err: AppError = disk_cleanup_domain::DomainError::UnknownTier("x".into()).into();
    assert!(err.to_string().contains("tier"));
}

#[test]
fn tilde_followed_by_a_name_is_literal() {
    assert_eq!(expand_template("~backup/x", &env()), Ok("~backup/x".into()));
}

#[test]
fn catalog_exclusion_with_unresolved_variable_is_kept_literally() {
    let catalog = Catalog {
        projects: Vec::new(),
        project_roots: Vec::new(),
        rules: vec![],
        exclusions: vec![CatalogExclusion {
            pattern: r"%SEM_VAR%\x".into(),
            reason: LocalizedText::same("r"),
        }],
    };
    let report = ClassifyService::new(&FakeCatalog(Ok(catalog)), &env(), &inspector())
        .run(ExclusionList::default(), &[])
        .unwrap();
    assert_eq!(report.exclusions.entries()[0].pattern, r"%SEM_VAR%\x");
    assert!(report.candidates.is_empty());
}

#[test]
fn services_have_debug_representation() {
    let (c, e, i) = (FakeCatalog(Ok(Catalog::default())), env(), inspector());
    assert_eq!(
        format!("{:?}", ClassifyService::new(&c, &e, &i)),
        "ClassifyService"
    );
}

#[test]
fn settings_exclusions_are_added_on_top_of_the_baseline_and_blank_ones_ignored() {
    let report = ClassifyService::new(&FakeCatalog(Ok(catalog())), &env(), &inspector())
        .run(
            ExclusionList::default(),
            &[r"C:\gradle".into(), "  ".into()],
        )
        .unwrap();
    assert!(report.candidates.iter().all(|c| c.id != "gradle"));
    let gradle = report.skipped.iter().find(|s| s.id == "gradle").unwrap();
    assert_eq!(
        gradle.reason,
        SkipReason::Excluded(LocalizedText::new(
            "excluída nas Configurações",
            "excluded in Settings"
        ))
    );
    assert_eq!(report.exclusions.len(), 2);
}

// ---------- Artefatos de projeto ----------

use disk_cleanup_application::{FoundArtifact, ProjectFinder, ProjectProfile};
use std::cell::RefCell;

/// Finder falso: devolve artefatos prontos e registra as pastas pedidas.
struct FakeFinder {
    found: Vec<FoundArtifact>,
    roots: RefCell<Vec<String>>,
}

impl ProjectFinder for FakeFinder {
    fn find(&self, roots: &[String], profiles: &[ProjectProfile]) -> Vec<FoundArtifact> {
        assert_eq!(profiles.len(), 1);
        self.roots.borrow_mut().extend(roots.iter().cloned());
        self.found.clone()
    }
}

fn artifact(project: &str, name: &str, idle: Option<u32>) -> FoundArtifact {
    FoundArtifact {
        profile: "node".into(),
        project: project.into(),
        path: format!(r"{project}\{name}"),
        idle_days: idle,
    }
}

fn project_catalog() -> Catalog {
    Catalog {
        projects: vec![ProjectProfile {
            id: "node".into(),
            label: LocalizedText::same("Node.js"),
            markers: vec!["package.json".into()],
            artifacts: vec!["node_modules".into()],
            note: LocalizedText::new("npm install recria", "npm install recreates"),
        }],
        project_roots: vec![r"%USERPROFILE%\workspace".into(), r"%SEM_VAR%\x".into()],
        ..Catalog::default()
    }
}

#[test]
fn project_artifacts_become_tier_c_candidates_with_idle_days() {
    let mut env = env();
    env.path = vec![r"C:\Users\u\workspace\cli\node_modules\.bin".into()];
    let finder = FakeFinder {
        found: vec![
            artifact(r"C:\Users\u\workspace\loja", "node_modules", Some(412)),
            artifact(r"C:\Users\u\workspace\novo", "node_modules", Some(0)),
            artifact(r"C:\Users\u\workspace\vazio", "node_modules", None),
            artifact(r"D:\Backups\velho", "node_modules", Some(900)),
            artifact(r"C:\Users\u\workspace\cli", "node_modules", Some(200)),
        ],
        roots: RefCell::default(),
    };
    let inspector = FakeInspector::with(&[
        (r"C:\Users\u\workspace\loja\node_modules", 1_900),
        (r"C:\Users\u\workspace\novo\node_modules", 800),
        (r"C:\Users\u\workspace\vazio\node_modules", 0),
        (r"D:\Backups\velho\node_modules", 50),
        (r"C:\Users\u\workspace\cli\node_modules", 70),
    ]);
    let catalog = FakeCatalog(Ok(project_catalog()));
    let baseline = ExclusionList::default().with(r"D:\Backups", LocalizedText::same("backup"));
    let report = ClassifyService::new(&catalog, &env, &inspector)
        .with_projects(&finder, &[r" D:\dev ".into(), String::new()])
        .run(baseline, &[])
        .unwrap();

    // pastas do catálogo (variável ausente é ignorada) + as das Configurações
    assert_eq!(
        *finder.roots.borrow(),
        vec![r"C:\Users\u\workspace".to_string(), r"D:\dev".to_string()]
    );
    let ids: Vec<_> = report.candidates.iter().map(|c| c.id.as_str()).collect();
    assert_eq!(
        ids,
        [
            r"project:C:\Users\u\workspace\loja\node_modules",
            r"project:C:\Users\u\workspace\novo\node_modules",
            r"project:C:\Users\u\workspace\cli\node_modules",
        ]
    );
    let loja = &report.candidates[0];
    assert_eq!(loja.label, LocalizedText::same("loja · node_modules"));
    assert_eq!(loja.note.en, "npm install recreates");
    assert_eq!((loja.tier, loja.risk), (Tier::C, Risk::Redownload));
    assert_eq!(
        loja.action,
        Action::RemovePath {
            path: r"C:\Users\u\workspace\loja\node_modules".into()
        }
    );
    // binário no PATH dentro do artefato: bloqueado, como qualquer regra
    assert!(matches!(
        report.candidates[2].availability,
        Availability::Blocked {
            reason: BlockReason::PathEntry { .. }
        }
    ));
    // idade fica no relatório, por candidato
    let idle: Vec<_> = report
        .projects
        .iter()
        .map(|p| (p.id.as_str(), p.idle_days))
        .collect();
    assert_eq!(
        idle[0],
        (r"project:C:\Users\u\workspace\loja\node_modules", Some(412))
    );
    assert_eq!(idle[1].1, Some(0));
    assert_eq!(report.projects[0].project, r"C:\Users\u\workspace\loja");
    // excluído aparece em "sem candidato"; vazio some sem ruído
    assert!(report
        .skipped
        .iter()
        .any(|s| s.id == r"project:D:\Backups\velho\node_modules"
            && matches!(s.reason, SkipReason::Excluded(_))));
    assert!(!report.skipped.iter().any(|s| s.id.contains("vazio")));
}

#[test]
fn without_a_finder_or_profiles_there_are_no_project_candidates() {
    let finder = FakeFinder {
        found: vec![artifact(r"C:\p", "node_modules", Some(1))],
        roots: RefCell::default(),
    };
    let inspector = FakeInspector::with(&[(r"C:\p\node_modules", 10)]);
    let catalog = FakeCatalog(Ok(project_catalog()));
    let report = ClassifyService::new(&catalog, &env(), &inspector)
        .run(ExclusionList::default(), &[])
        .unwrap();
    assert!(report.candidates.is_empty() && report.projects.is_empty());

    let no_profiles = FakeCatalog(Ok(Catalog::default()));
    let report = ClassifyService::new(&no_profiles, &env(), &inspector)
        .with_projects(&finder, &[r"C:\p".into()])
        .run(ExclusionList::default(), &[])
        .unwrap();
    assert!(report.candidates.is_empty());
    assert!(finder.roots.borrow().is_empty());
}

// ---------- Arquivos grandes ----------

#[test]
fn large_files_become_tier_d_candidates_with_age_and_respect_exclusions() {
    use disk_cleanup_domain::{ByteSize, LargeFile};
    let files = vec![
        LargeFile {
            path: r"C:\Users\u\Downloads\ubuntu.iso".into(),
            size: ByteSize::from_bytes(5_000),
            modified: Some(100_000_000 - 86_400 * 400),
        },
        LargeFile {
            path: r"D:\Backups\velho.tar".into(),
            size: ByteSize::from_bytes(2_000),
            modified: None,
        },
        LargeFile {
            path: r"C:\Users\u\futuro.bin".into(),
            size: ByteSize::from_bytes(1_000),
            modified: Some(200_000_000),
        },
    ];
    let catalog = FakeCatalog(Ok(Catalog::default()));
    let baseline = ExclusionList::default().with(r"D:\Backups", LocalizedText::same("backup"));
    let report = ClassifyService::new(&catalog, &env(), &FakeInspector::default())
        .with_large_files(&files, 100_000_000)
        .run(baseline, &[])
        .unwrap();
    let iso = &report.candidates[0];
    assert_eq!(iso.id, r"file:C:\Users\u\Downloads\ubuntu.iso");
    assert_eq!(iso.label, LocalizedText::same("ubuntu.iso"));
    assert_eq!(
        (iso.tier, iso.risk, iso.size.bytes()),
        (Tier::D, Risk::Low, 5_000)
    );
    assert_eq!(report.candidates.len(), 2);
    let ages: Vec<_> = report.large_files.iter().map(|f| f.age_days).collect();
    // data no futuro (relógio adiantado) conta como hoje
    assert_eq!(ages, vec![Some(400), Some(0)]);
    assert!(report.skipped.iter().any(
        |s| s.id == r"file:D:\Backups\velho.tar" && matches!(s.reason, SkipReason::Excluded(_))
    ));
}

// ---------- Regras próprias e perfis ----------

#[test]
fn user_rules_follow_the_same_exclusions_and_disabled_profiles_are_not_searched() {
    let user = vec![
        rule("user:teams", Tier::A, path(r"%LOCALAPPDATA%\Teams\Cache")),
        rule("user:dentro", Tier::C, path(r"D:\Backups\x")),
        rule("user:pai", Tier::C, path(r"D:\")),
    ];
    let inspector = FakeInspector::with(&[
        (r"C:\Users\u\AppData\Local\Teams\Cache", 300),
        (r"D:\Backups\x", 10),
        (r"D:\", 10),
    ]);
    let catalog = FakeCatalog(Ok(project_catalog()));
    let finder = FakeFinder {
        found: vec![],
        roots: RefCell::default(),
    };
    let baseline = ExclusionList::default().with(r"D:\Backups", LocalizedText::same("backup"));
    let disabled = vec!["node".to_string()];
    let report = ClassifyService::new(&catalog, &env(), &inspector)
        .with_projects(&finder, &[r"D:\dev".into()])
        .with_user_rules(&user, &disabled)
        .run(baseline, &[])
        .unwrap();
    let ids: Vec<_> = report.candidates.iter().map(|c| c.id.as_str()).collect();
    assert_eq!(ids, ["user:teams"]);
    // dentro e contendo uma exclusão: os dois recusados
    for id in ["user:dentro", "user:pai"] {
        assert!(
            report
                .skipped
                .iter()
                .any(|s| s.id == id && matches!(s.reason, SkipReason::Excluded(_))),
            "{id}"
        );
    }
    // único perfil desligado: o finder nem é chamado
    assert!(finder.roots.borrow().is_empty());
}

#[test]
fn effective_exclusions_add_settings_and_catalog_entries() {
    use disk_cleanup_application::effective_exclusions;
    let catalog = Catalog {
        exclusions: vec![CatalogExclusion {
            pattern: r"%USERPROFILE%\.claude".into(),
            reason: LocalizedText::same("claude"),
        }],
        ..Catalog::default()
    };
    let list = effective_exclusions(
        &catalog,
        &env(),
        ExclusionList::default(),
        &[" D:\\x ".into(), String::new()],
    );
    assert!(list.conflicting(r"D:\x\y").is_some());
    assert!(list.conflicting(r"C:\Users\u\.claude\projects").is_some());
    assert_eq!(list.len(), 2);
}
