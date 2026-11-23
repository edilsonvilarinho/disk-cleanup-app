use std::cell::RefCell;
use std::collections::BTreeSet;

use disk_cleanup_application::{
    ActionRunner, AppError, CommandOutcome, ExecuteService, ExecutionProgress, PortError,
    RemovalOutcome, VolumeInfo,
};
use disk_cleanup_domain::{
    approve, signed_delta, Action, ApprovedPlan, Availability, ByteSize, Candidate, ExclusionList,
    FailCause, ItemResult, ItemStatus, LocalizedText, Plan, Risk, SafetyGuard, SafetyViolation,
    SkipCause, Tier, VolumeUsage,
};

fn b(n: u64) -> ByteSize {
    ByteSize::from_bytes(n)
}

/// Volume cujo espaço livre cresce com o que o runner "libera".
struct SharedVolume(RefCell<u64>);

impl VolumeInfo for SharedVolume {
    fn usage(&self, _: &str) -> Result<VolumeUsage, PortError> {
        Ok(VolumeUsage::new(b(10_000), b(*self.0.borrow())).unwrap())
    }
}

struct FailingVolume;
impl VolumeInfo for FailingVolume {
    fn usage(&self, v: &str) -> Result<VolumeUsage, PortError> {
        Err(PortError::NotFound(v.into()))
    }
}

struct FakeRunner<'a> {
    volume: &'a SharedVolume,
    calls: RefCell<Vec<String>>,
}

impl ActionRunner for FakeRunner<'_> {
    fn remove_path(&self, path: &str) -> Result<RemovalOutcome, PortError> {
        self.calls.borrow_mut().push(format!("rm {path}"));
        let free = |n: u64| *self.volume.0.borrow_mut() += n;
        match path {
            p if p.ends_with("npm-cache") => {
                free(600);
                Ok(RemovalOutcome {
                    removed: b(600),
                    remaining: ByteSize::ZERO,
                    errors: vec![],
                })
            }
            p if p.ends_with("DXCache") => {
                free(300);
                Ok(RemovalOutcome {
                    removed: b(300),
                    remaining: b(50),
                    errors: vec!["dx.bin: em uso".into()],
                })
            }
            p if p.ends_with("Locked") => Ok(RemovalOutcome {
                removed: ByteSize::ZERO,
                remaining: b(10),
                errors: vec![],
            }),
            p if p.ends_with("sumiu") => Err(PortError::NotFound(p.into())),
            p => Err(PortError::Io(format!("acesso negado: {p}"))),
        }
    }

    fn run_command(&self, command: &str) -> Result<CommandOutcome, PortError> {
        self.calls.borrow_mut().push(format!("cmd {command}"));
        match command {
            "pip cache purge" => {
                *self.volume.0.borrow_mut() += 100;
                Ok(CommandOutcome {
                    success: true,
                    code: Some(0),
                    output: "Files removed: 9".into(),
                })
            }
            "falha" => Ok(CommandOutcome {
                success: false,
                code: Some(3),
                output: "linha 1\nerro final".into(),
            }),
            _ => Err(PortError::Io("programa não encontrado".into())),
        }
    }
}

#[derive(Default)]
struct Events(RefCell<Vec<String>>);

impl ExecutionProgress for Events {
    fn item_started(&self, id: &str) {
        self.0.borrow_mut().push(format!("start {id}"));
    }
    fn item_finished(&self, result: &ItemResult) {
        self.0
            .borrow_mut()
            .push(format!("end {} {}", result.id, result.status.code()));
    }
}

fn candidate(id: &str, tier: Tier, action: Action) -> Candidate {
    Candidate {
        id: id.into(),
        label: LocalizedText::same(id),
        tier,
        action,
        size: b(100),
        risk: Risk::None,
        note: LocalizedText::default(),
        availability: Availability::Selectable,
    }
}

fn rm(p: &str) -> Action {
    Action::RemovePath { path: p.into() }
}

fn approved(tiers: &[Tier]) -> ApprovedPlan {
    let candidates = vec![
        candidate("npm", Tier::A, rm(r"C:\Users\u\AppData\Local\npm-cache")),
        candidate(
            "pip",
            Tier::A,
            Action::Command {
                command: "pip cache purge".into(),
            },
        ),
        candidate(
            "dx",
            Tier::A,
            rm(r"C:\Users\u\AppData\Local\NVIDIA\DXCache"),
        ),
        candidate("locked", Tier::A, rm(r"C:\Users\u\AppData\Local\Locked")),
        candidate("sumiu", Tier::A, rm(r"C:\Users\u\AppData\Local\sumiu")),
        candidate("negado", Tier::A, rm(r"C:\Users\u\AppData\Local\negado")),
        candidate("amplo", Tier::A, rm(r"C:\Users")),
        candidate(
            "falha",
            Tier::C,
            Action::Command {
                command: "falha".into(),
            },
        ),
        candidate(
            "semprog",
            Tier::C,
            Action::Command {
                command: "xyz".into(),
            },
        ),
        candidate(
            "app",
            Tier::C,
            Action::Uninstall {
                display_name: "App".into(),
                also_remove: vec![],
            },
        ),
    ];
    let ids: Vec<&str> = candidates.iter().map(|c| c.id.as_str()).collect();
    let plan = Plan::from_selection("C:", &candidates, &ids, &ExclusionList::default()).unwrap();
    approve(
        &plan,
        &[],
        &tiers.iter().copied().collect::<BTreeSet<_>>(),
        true,
    )
    .unwrap()
}

#[test]
fn preview_lists_the_steps_of_an_approved_tier_without_running_anything() {
    let volume = SharedVolume(RefCell::new(1_000));
    let runner = FakeRunner {
        volume: &volume,
        calls: RefCell::default(),
    };
    let events = Events::default();
    let guard = SafetyGuard::new(vec![]);
    let service = ExecuteService::new(&runner, &volume, &guard, &events);
    let steps = service
        .preview(&approved(&[Tier::A, Tier::C]), Tier::C)
        .unwrap();
    let ids: Vec<_> = steps
        .iter()
        .map(|s| (s.id.as_str(), s.kind, s.target.as_str()))
        .collect();
    assert_eq!(
        ids,
        [
            ("falha", "command", "falha"),
            ("semprog", "command", "xyz"),
            ("app", "uninstall", "App")
        ]
    );
    assert_eq!(steps[0].estimated, b(100));
    assert!(runner.calls.borrow().is_empty());
    assert_eq!(
        service.preview(&approved(&[Tier::A]), Tier::C).unwrap_err(),
        AppError::TierNotApproved(Tier::C)
    );
}

#[test]
fn execute_runs_every_item_measures_each_one_and_never_aborts_on_failure() {
    let volume = SharedVolume(RefCell::new(1_000));
    let runner = FakeRunner {
        volume: &volume,
        calls: RefCell::default(),
    };
    let events = Events::default();
    let guard = SafetyGuard::new(vec![]);
    let run = ExecuteService::new(&runner, &volume, &guard, &events)
        .execute(&approved(&[Tier::A]), Tier::A)
        .unwrap();

    assert_eq!(run.tier, Tier::A);
    assert_eq!((run.free_before, run.free_after), (b(1_000), b(2_000)));
    assert_eq!(run.freed(), 1_000);
    let statuses: Vec<_> = run
        .items
        .iter()
        .map(|i| (i.id.as_str(), i.status.clone()))
        .collect();
    assert_eq!(
        statuses,
        vec![
            ("npm", ItemStatus::Done),
            ("pip", ItemStatus::Done),
            (
                "dx",
                ItemStatus::Partial {
                    remaining: b(50),
                    detail: Some("dx.bin: em uso".into()),
                },
            ),
            (
                "locked",
                ItemStatus::Partial {
                    remaining: b(10),
                    detail: None,
                },
            ),
            (
                "sumiu",
                ItemStatus::Skipped {
                    cause: SkipCause::Missing,
                },
            ),
            (
                "negado",
                ItemStatus::Failed {
                    cause: FailCause::Io(r"acesso negado: C:\Users\u\AppData\Local\negado".into()),
                },
            ),
            (
                "amplo",
                ItemStatus::Skipped {
                    cause: SkipCause::Unsafe(SafetyViolation::TooBroad {
                        target: r"C:\Users".into(),
                    }),
                },
            ),
        ]
    );
    assert_eq!(run.items[0].freed(), 600);
    assert_eq!(run.items[2].freed(), 300);
    // a guarda impede que o runner sequer seja chamado para o alvo amplo
    assert!(!runner.calls.borrow().iter().any(|c| c == r"rm C:\Users"));
    assert_eq!(
        events.0.borrow().first().map(String::as_str),
        Some("start npm")
    );
    assert_eq!(
        events.0.borrow().last().map(String::as_str),
        Some("end amplo skipped")
    );
    assert_eq!(events.0.borrow().len(), 14);
}

#[test]
fn commands_report_exit_code_and_last_output_line_and_uninstall_is_not_supported_yet() {
    let volume = SharedVolume(RefCell::new(1_000));
    let runner = FakeRunner {
        volume: &volume,
        calls: RefCell::default(),
    };
    let events = Events::default();
    let guard = SafetyGuard::new(vec![]);
    let run = ExecuteService::new(&runner, &volume, &guard, &events)
        .execute(&approved(&[Tier::C]), Tier::C)
        .unwrap();
    let statuses: Vec<_> = run.items.iter().map(|i| i.status.clone()).collect();
    assert_eq!(
        statuses,
        vec![
            ItemStatus::Failed {
                cause: FailCause::Exit {
                    code: Some(3),
                    last_line: "erro final".into(),
                },
            },
            ItemStatus::Failed {
                cause: FailCause::Io("programa não encontrado".into()),
            },
            ItemStatus::Skipped {
                cause: SkipCause::UninstallUnsupported,
            },
        ]
    );
    assert_eq!(run.freed(), 0);
}

#[test]
fn execute_refuses_unapproved_tier_and_reports_volume_failure() {
    let volume = SharedVolume(RefCell::new(1_000));
    let runner = FakeRunner {
        volume: &volume,
        calls: RefCell::default(),
    };
    let events = Events::default();
    let guard = SafetyGuard::new(vec![]);
    let service = ExecuteService::new(&runner, &volume, &guard, &events);
    assert!(matches!(
        service.execute(&approved(&[Tier::A]), Tier::C),
        Err(AppError::TierNotApproved(Tier::C))
    ));

    let failing = ExecuteService::new(&runner, &FailingVolume, &guard, &events);
    assert_eq!(
        failing.execute(&approved(&[Tier::A]), Tier::A).unwrap_err(),
        AppError::Port(PortError::NotFound("C:".into()))
    );
    assert!(runner.calls.borrow().is_empty());
    assert_eq!(format!("{service:?}"), "ExecuteService");
}

#[test]
fn signed_delta_saturates_in_both_directions() {
    assert_eq!(signed_delta(b(u64::MAX), b(0)), i64::MIN);
}
