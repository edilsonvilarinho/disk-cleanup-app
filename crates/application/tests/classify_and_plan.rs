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
