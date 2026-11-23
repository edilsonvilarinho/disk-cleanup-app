use std::cell::RefCell;

use disk_cleanup_application::{
    ActionRunner, Catalog, CatalogExclusion, CatalogRepository, CatalogRule, CommandOutcome,
    PathInspector, PortError, RemovalOutcome, RuleTarget, VolumeInfo,
};
use disk_cleanup_desktop_lib::{
    approve_plan, build_plan, classify, execute_tier, preview_tier, report, CallbackExecution,
    ExecutionEventDto, Session,
};
use disk_cleanup_domain::{ByteSize, ExclusionList, Risk, SafetyGuard, Tier, VolumeUsage};
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
    fn run_command(&self, _: &str) -> Result<CommandOutcome, PortError> {
        *self.0 .0.borrow_mut() += 100;
        Ok(CommandOutcome {
            success: true,
            code: Some(0),
            output: String::new(),
        })
    }
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
            label: id.into(),
            tier,
            risk: Risk::None,
            note: String::new(),
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
                reason: "msi".into(),
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
    let empty = Session::default();
    assert!(approve_plan(&empty, &["A".into()], true)
        .unwrap_err()
        .contains("plano"));

    let session = prepared();
    assert!(approve_plan(&session, &["Z".into()], true)
        .unwrap_err()
        .contains("tier"));
    assert!(approve_plan(&session, &["A".into()], false)
        .unwrap_err()
        .contains("revisão"));
    assert!(approve_plan(&session, &[], true)
        .unwrap_err()
        .contains("nenhum tier"));

    let dto = approve_plan(&session, &["A".into(), "C".into()], true).unwrap();
    assert_eq!(dto.tiers, ["A", "C"]);
    assert_eq!(dto.item_count, 3);
}

#[test]
fn preview_and_execute_only_after_approval_and_once_per_tier() {
    let session = prepared();
    let volume = Volume(RefCell::new(1_000));
    let runner = Runner(&volume);
    let guard = SafetyGuard::default();
    let events = RefCell::new(Vec::new());
    let progress = CallbackExecution::new(|e: ExecutionEventDto| events.borrow_mut().push(e));

    assert!(preview_tier(&session, &runner, &volume, &guard, "A")
        .unwrap_err()
        .contains("aprovado"));
    assert!(
        execute_tier(&session, &runner, &volume, &guard, &progress, "A")
            .unwrap_err()
            .contains("aprovado")
    );
    assert!(report(&session, &volume).unwrap_err().contains("execução"));

    approve_plan(&session, &["A".into(), "C".into()], true).unwrap();
    let steps = preview_tier(&session, &runner, &volume, &guard, "A").unwrap();
    assert_eq!(
        steps.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
        ["npm", "dx"]
    );
    assert_eq!(steps[0].kind, "path");
    assert_eq!(steps[0].estimated_bytes, 400);
    assert!(preview_tier(&session, &runner, &volume, &guard, "Q")
        .unwrap_err()
        .contains("tier"));

    let run = execute_tier(&session, &runner, &volume, &guard, &progress, "A").unwrap();
    assert_eq!(run.tier, "A");
    assert_eq!(run.freed_bytes, 400);
    assert_eq!(run.items[0].status, "ok");
    assert_eq!(run.items[1].status, "parcial");
    assert_eq!(run.items[1].detail.as_deref(), Some("em uso"));
    assert_eq!(events.borrow().len(), 4);
    assert_eq!(events.borrow()[0].kind, "started");
    assert_eq!(events.borrow()[1].result.as_ref().unwrap().status, "ok");

    assert!(
        execute_tier(&session, &runner, &volume, &guard, &progress, "A")
            .unwrap_err()
            .contains("já executado")
    );
    assert!(
        execute_tier(&session, &runner, &volume, &guard, &progress, "Q")
            .unwrap_err()
            .contains("tier")
    );
    execute_tier(&session, &runner, &volume, &guard, &progress, "C").unwrap();

    let r = report(&session, &volume).unwrap();
    assert_eq!(r.initial.free_bytes, 1_000);
    assert_eq!(r.last.free_bytes, 1_500);
    assert_eq!(r.freed_bytes, 500);
    assert_eq!(r.estimated_bytes, 1_200);
    assert_eq!(r.runs.len(), 2);
    assert_eq!(r.pending.len(), 1);
    assert_eq!(r.pending[0].id, "dx");
    assert_eq!(r.blocked.len(), 1);
    assert_eq!(r.blocked[0].id, "cuda");
    assert_eq!(r.exclusions[0].pattern, r"C:\Windows\Installer");
    assert_eq!(format!("{progress:?}"), "CallbackExecution");
}

#[test]
fn rebuilding_the_plan_resets_the_approval_and_the_runs() {
    let session = prepared();
    let volume = Volume(RefCell::new(1_000));
    let runner = Runner(&volume);
    let guard = SafetyGuard::default();
    let progress = CallbackExecution::new(|_| {});
    approve_plan(&session, &["A".into()], true).unwrap();
    execute_tier(&session, &runner, &volume, &guard, &progress, "A").unwrap();
    build_plan(&session, "C:", &["npm".into()], &SkillPlanJsonCodec).unwrap();
    assert!(
        execute_tier(&session, &runner, &volume, &guard, &progress, "A")
            .unwrap_err()
            .contains("aprovado")
    );
    assert!(report(&session, &volume).unwrap_err().contains("execução"));
}

#[test]
fn volume_failure_is_reported_as_message() {
    struct Broken;
    impl VolumeInfo for Broken {
        fn usage(&self, _: &str) -> Result<VolumeUsage, PortError> {
            Err(PortError::NotFound("C:".into()))
        }
    }
    let session = prepared();
    let volume = Volume(RefCell::new(1_000));
    let progress = CallbackExecution::new(|_| {});
    approve_plan(&session, &["A".into()], true).unwrap();
    let err = execute_tier(
        &session,
        &Runner(&volume),
        &Broken,
        &SafetyGuard::default(),
        &progress,
        "A",
    )
    .unwrap_err();
    assert!(err.contains("não encontrado"));
}

#[test]
fn safety_guard_protects_the_folders_named_by_the_environment() {
    use disk_cleanup_desktop_lib::safety_guard;
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
