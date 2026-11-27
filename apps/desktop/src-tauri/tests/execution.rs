use std::cell::RefCell;
use std::collections::BTreeMap;

use disk_cleanup_application::{
    ActionRunner, Catalog, CatalogExclusion, CatalogRepository, CatalogRule, CommandOutcome,
    PathInspector, PortError, RemovalOutcome, RuleTarget, VolumeInfo,
};
use disk_cleanup_desktop_lib::{
    approve_plan, build_plan, classify, execute_tier, preview_tier, report, safety_guard,
    CallbackExecution, ExecutionEventDto, ItemResultDto, Session,
};
use disk_cleanup_domain::{
    ByteSize, ExclusionList, FailCause, ItemResult, ItemStatus, LocalizedText, Risk, SafetyGuard,
    SafetyViolation, SkipCause, Tier, VolumeUsage,
};
use disk_cleanup_infrastructure::{SkillPlanJsonCodec, SnapshotEnvironment};

struct Volume(RefCell<u64>);
impl VolumeInfo for Volume {
    fn usage(&self, _: &str) -> Result<VolumeUsage, PortError> {
        Ok(VolumeUsage::new(
            ByteSize::from_bytes(10_000),
            ByteSize::from_bytes(*self.0.borrow()),
        )
        .unwrap())
    }
}

struct Runner<'a>(&'a Volume);
impl ActionRunner for Runner<'_> {
    fn remove_path(&self, path: &str) -> Result<RemovalOutcome, PortError> {
        if path.ends_with("dx") {
            return Ok(RemovalOutcome {
                removed: ByteSize::ZERO,
                remaining: ByteSize::from_bytes(5),
                errors: vec!["em uso".into()],
            });
        }
        *self.0 .0.borrow_mut() += 400;
        Ok(RemovalOutcome {
            removed: ByteSize::from_bytes(400),
            remaining: ByteSize::ZERO,
            errors: vec![],
        })
    }
    /// Lixeira não libera espaço no volume.
    fn trash_path(&self, _: &str) -> Result<RemovalOutcome, PortError> {
        Ok(RemovalOutcome {
            removed: ByteSize::from_bytes(400),
            remaining: ByteSize::ZERO,
            errors: vec![],
        })
    }
    fn run_command(&self, _: &str) -> Result<CommandOutcome, PortError> {
        *self.0 .0.borrow_mut() += 100;
        Ok(CommandOutcome {
            success: true,
            code: Some(0),
            output: String::new(),
        })
    }
}

fn none() -> BTreeMap<String, String> {
    BTreeMap::new()
}

struct Inspector;
impl PathInspector for Inspector {
    fn exists(&self, _: &str) -> bool {
        true
    }
    fn size_of(&self, _: &str) -> Result<ByteSize, PortError> {
        Ok(ByteSize::from_bytes(400))
    }
}

struct Catalogue;
impl CatalogRepository for Catalogue {
    fn load(&self) -> Result<Catalog, PortError> {
        let rule = |id: &str, tier, target| CatalogRule {
            id: id.into(),
            label: LocalizedText::same(id),
            tier,
            risk: Risk::None,
            note: LocalizedText::default(),
            target,
            watch_env: vec!["CUDA_PATH".into()],
        };
        let path = |p: &str| RuleTarget::Path { path: p.into() };
        Ok(Catalog {
            rules: vec![
                rule("npm", Tier::A, path(r"C:\Users\u\AppData\Local\npm")),
                rule("dx", Tier::A, path(r"C:\Users\u\AppData\Local\dx")),
                rule(
                    "pip",
                    Tier::C,
                    RuleTarget::Command {
                        command: "pip cache purge".into(),
                        measure: r"C:\x\pip".into(),
                    },
                ),
                rule("cuda", Tier::C, path(r"C:\cuda")),
            ],
            exclusions: vec![CatalogExclusion {
                pattern: r"C:\Windows\Installer".into(),
                reason: LocalizedText::new("msi", "msi cache"),
            }],
        })
    }
}

fn prepared() -> Session {
    let session = Session::default();
    let env = SnapshotEnvironment::from_pairs(vec![("CUDA_PATH".into(), r"C:\cuda".into())]);
    classify(
        &session,
        &Catalogue,
        &env,
        &Inspector,
        ExclusionList::default(),
        &[],
    )
    .unwrap();
    build_plan(
        &session,
        "C:",
        &["npm".into(), "dx".into(), "pip".into()],
        &SkillPlanJsonCodec,
    )
    .unwrap();
    session
}

#[test]
fn approval_requires_a_plan_tiers_and_acknowledgement() {
    assert_eq!(
        approve_plan(&Session::default(), &["A".into()], &none(), true)
            .unwrap_err()
            .code,
        "plan_required"
    );
    let session = prepared();
    let err = approve_plan(&session, &["Z".into()], &none(), true).unwrap_err();
    assert_eq!(
        (err.code.as_str(), err.params["value"].as_str()),
        ("unknown_tier", "Z")
    );
    assert_eq!(
        approve_plan(&session, &["A".into()], &none(), false)
            .unwrap_err()
            .code,
        "approval_not_acknowledged"
    );
    assert_eq!(
        approve_plan(&session, &[], &none(), true).unwrap_err().code,
        "approval_no_tier"
    );
    let dto = approve_plan(&session, &["A".into(), "C".into()], &none(), true).unwrap();
    assert_eq!(
        (dto.tiers.clone(), dto.item_count),
        (vec!["A".to_string(), "C".to_string()], 3)
    );
}

#[test]
fn preview_and_execute_only_after_approval_and_once_per_tier() {
    let session = prepared();
    let volume = Volume(RefCell::new(1_000));
    let runner = Runner(&volume);
    let guard = SafetyGuard::default();
    let events = RefCell::new(Vec::new());
    let progress = CallbackExecution::new(|e: ExecutionEventDto| events.borrow_mut().push(e));

    assert_eq!(
        preview_tier(&session, &runner, &volume, &guard, "A")
            .unwrap_err()
            .code,
        "not_approved"
    );
    assert_eq!(
        execute_tier(&session, &runner, &volume, &guard, &progress, "A")
            .unwrap_err()
            .code,
        "not_approved"
    );
    assert_eq!(report(&session, &volume).unwrap_err().code, "no_execution");

    approve_plan(&session, &["A".into(), "C".into()], &none(), true).unwrap();
    let steps = preview_tier(&session, &runner, &volume, &guard, "A").unwrap();
    assert_eq!(
        steps.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
        ["npm", "dx"]
    );
    assert_eq!(
        (
            steps[0].kind,
            steps[0].estimated_bytes,
            steps[0].label.en.as_str()
        ),
        ("path", 400, "npm")
    );
    assert_eq!(
        preview_tier(&session, &runner, &volume, &guard, "Q")
            .unwrap_err()
            .code,
        "unknown_tier"
    );

    let run = execute_tier(&session, &runner, &volume, &guard, &progress, "A").unwrap();
    assert_eq!((run.tier.as_str(), run.freed_bytes), ("A", 400));
    assert_eq!(run.items[0].status, "ok");
    assert!(run.items[0].cause.is_none());
    assert_eq!(run.items[1].status, "partial");
    let cause = run.items[1].cause.as_ref().unwrap();
    assert_eq!(
        (cause.code, cause.detail.as_deref()),
        ("partial_os", Some("em uso"))
    );
    assert_eq!(events.borrow().len(), 4);
    assert_eq!(events.borrow()[0].kind, "started");
    assert_eq!(events.borrow()[1].result.as_ref().unwrap().status, "ok");

    let err = execute_tier(&session, &runner, &volume, &guard, &progress, "A").unwrap_err();
    assert_eq!(
        (err.code.as_str(), err.params["tier"].as_str()),
        ("tier_already_run", "A")
    );
    assert_eq!(
        execute_tier(&session, &runner, &volume, &guard, &progress, "Q")
            .unwrap_err()
            .code,
        "unknown_tier"
    );
    execute_tier(&session, &runner, &volume, &guard, &progress, "C").unwrap();

    let r = report(&session, &volume).unwrap();
    assert_eq!(
        (
            r.initial.free_bytes,
            r.last.free_bytes,
            r.freed_bytes,
            r.estimated_bytes
        ),
        (1_000, 1_500, 500, 1_200)
    );
    assert_eq!(
        (r.runs.len(), r.pending.len(), r.pending[0].id.as_str()),
        (2, 1, "dx")
    );
    assert_eq!((r.blocked.len(), r.blocked[0].id.as_str()), (1, "cuda"));
    assert_eq!(r.exclusions[0].reason.en, "msi cache");
    assert_eq!(format!("{progress:?}"), "CallbackExecution");
}

#[test]
fn rebuilding_the_plan_resets_the_approval_and_the_runs() {
    let session = prepared();
    let volume = Volume(RefCell::new(1_000));
    let runner = Runner(&volume);
    let guard = SafetyGuard::default();
    let progress = CallbackExecution::new(|_| {});
    approve_plan(&session, &["A".into()], &none(), true).unwrap();
    execute_tier(&session, &runner, &volume, &guard, &progress, "A").unwrap();
    build_plan(&session, "C:", &["npm".into()], &SkillPlanJsonCodec).unwrap();
    assert_eq!(
        execute_tier(&session, &runner, &volume, &guard, &progress, "A")
            .unwrap_err()
            .code,
        "not_approved"
    );
    assert_eq!(report(&session, &volume).unwrap_err().code, "no_execution");
}

#[test]
fn volume_failure_is_reported_as_code() {
    struct Broken;
    impl VolumeInfo for Broken {
        fn usage(&self, _: &str) -> Result<VolumeUsage, PortError> {
            Err(PortError::NotFound("C:".into()))
        }
    }
    let session = prepared();
    let volume = Volume(RefCell::new(1_000));
    let progress = CallbackExecution::new(|_| {});
    approve_plan(&session, &["A".into()], &none(), true).unwrap();
    let err = execute_tier(
        &session,
        &Runner(&volume),
        &Broken,
        &SafetyGuard::default(),
        &progress,
        "A",
    )
    .unwrap_err();
    assert_eq!(
        (err.code.as_str(), err.params["detail"].as_str()),
        ("not_found", "C:")
    );
}

#[test]
fn every_item_cause_has_a_code() {
    let item = |status| ItemResult {
        id: "x".into(),
        label: LocalizedText::same("X"),
        tier: Tier::A,
        estimated: ByteSize::from_bytes(1),
        free_before: ByteSize::from_bytes(10),
        free_after: ByteSize::from_bytes(10),
        status,
        trashed: ByteSize::ZERO,
    };
    let cases = [
        (
            ItemStatus::Partial {
                remaining: ByteSize::from_bytes(1),
                detail: None,
            },
            "partial",
            "partial_locked",
            None,
            None,
        ),
        (
            ItemStatus::Skipped {
                cause: SkipCause::Missing,
            },
            "skipped",
            "missing",
            None,
            None,
        ),
        (
            ItemStatus::Skipped {
                cause: SkipCause::UninstallUnsupported,
            },
            "skipped",
            "uninstall_unsupported",
            None,
            None,
        ),
        (
            ItemStatus::Skipped {
                cause: SkipCause::Unsafe(SafetyViolation::TooBroad {
                    target: "/home".into(),
                }),
            },
            "skipped",
            "too_broad",
            Some("/home"),
            None,
        ),
        (
            ItemStatus::Skipped {
                cause: SkipCause::Unsafe(SafetyViolation::Protected {
                    path: "/home/u".into(),
                }),
            },
            "skipped",
            "protected",
            Some("/home/u"),
            None,
        ),
        (
            ItemStatus::Failed {
                cause: FailCause::Io("negado".into()),
            },
            "failed",
            "io",
            Some("negado"),
            None,
        ),
        (
            ItemStatus::Failed {
                cause: FailCause::Exit {
                    code: Some(3),
                    last_line: "fim".into(),
                },
            },
            "failed",
            "exit",
            Some("fim"),
            Some(3),
        ),
    ];
    for (status, code, cause_code, detail, exit) in cases {
        let dto = ItemResultDto::from(&item(status));
        let cause = dto.cause.unwrap();
        assert_eq!(
            (
                dto.status,
                cause.code,
                cause.detail.as_deref(),
                cause.exit_code
            ),
            (code, cause_code, detail, exit)
        );
    }
}

#[test]
fn safety_guard_protects_the_folders_named_by_the_environment() {
    let env = SnapshotEnvironment::from_pairs(vec![
        ("USERPROFILE".into(), r"C:\Users\u".into()),
        ("LOCALAPPDATA".into(), r"C:\Users\u\AppData\Local".into()),
        ("TEMP".into(), r"C:\Users\u\AppData\Local\Temp".into()),
    ]);
    let guard = safety_guard(&env);
    assert!(guard.check(r"C:\Users\u").is_err());
    assert!(guard.check(r"C:\Users\u\AppData\Local").is_err());
    assert!(guard.check(r"C:\Users\u\AppData\Local\Temp").is_err());
    assert!(guard.check(r"C:\Users\u\AppData\Local\npm-cache").is_ok());
}

#[test]
fn approval_fixes_the_disposal_and_trash_is_reported_apart() {
    let session = prepared();
    let volume = Volume(RefCell::new(1_000));
    let runner = Runner(&volume);
    let guard = SafetyGuard::default();
    let progress = CallbackExecution::new(|_| {});
    let trash_a: BTreeMap<String, String> = [("a".into(), "Trash".into())].into();

    let err = approve_plan(
        &session,
        &["A".into()],
        &[("A".into(), "lixo".into())].into(),
        true,
    )
    .unwrap_err();
    assert_eq!(
        (err.code.as_str(), err.params["value"].as_str()),
        ("unknown_disposal", "lixo")
    );
    let err = approve_plan(
        &session,
        &["A".into()],
        &[("Q".into(), "trash".into())].into(),
        true,
    )
    .unwrap_err();
    assert_eq!(err.code, "unknown_tier");

    let dto = approve_plan(&session, &["A".into(), "C".into()], &trash_a, true).unwrap();
    assert_eq!(
        dto.disposals,
        BTreeMap::from([("A".to_string(), "trash"), ("C".to_string(), "trash")])
    );
    let steps = preview_tier(&session, &runner, &volume, &guard, "A").unwrap();
    assert_eq!(steps[0].disposal, Some("trash"));
    let steps = preview_tier(&session, &runner, &volume, &guard, "C").unwrap();
    assert_eq!(steps[0].disposal, None);

    let run = execute_tier(&session, &runner, &volume, &guard, &progress, "A").unwrap();
    assert_eq!((run.freed_bytes, run.trashed_bytes), (0, 800));
    assert_eq!(
        (run.items[0].status, run.items[0].trashed_bytes),
        ("ok", 400)
    );
    let r = report(&session, &volume).unwrap();
    assert_eq!((r.freed_bytes, r.trashed_bytes), (0, 800));

    // padrão sem escolha: A definitivo
    let dto = approve_plan(&session, &["A".into()], &none(), true).unwrap();
    assert_eq!(
        dto.disposals,
        BTreeMap::from([("A".to_string(), "permanent")])
    );
}
