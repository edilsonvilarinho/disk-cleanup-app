use std::collections::BTreeSet;

use disk_cleanup_domain::{
    approve, Action, ApprovalError, Availability, ByteSize, Candidate, Decision, DomainError,
    ExclusionList, Plan, PlanError, Risk, Tier,
};

fn candidate(id: &str, tier: Tier, action: Action, gb_bytes: u64) -> Candidate {
    Candidate {
        id: id.into(),
        label: disk_cleanup_domain::LocalizedText::same(&id.to_uppercase()),
        tier,
        action,
        size: ByteSize::from_bytes(gb_bytes),
        risk: Risk::None,
        note: disk_cleanup_domain::LocalizedText::default(),
        availability: Availability::Selectable,
    }
}

fn remove(path: &str) -> Action {
    Action::RemovePath { path: path.into() }
}

fn sample() -> Vec<Candidate> {
    let mut blocked = candidate(
        "cuda",
        Tier::B,
        Action::Uninstall {
            display_name: "NVIDIA CUDA".into(),
            also_remove: vec![],
        },
        5,
    );
    blocked.availability = Availability::Blocked {
        reason: disk_cleanup_domain::BlockReason::EnvVar {
            name: "CUDA_PATH".into(),
        },
    };
    vec![
        candidate("npm", Tier::A, remove(r"C:\L\npm-cache"), 10),
        candidate(
            "dism",
            Tier::D,
            Action::Command {
                command: "DISM /Online".into(),
            },
            7,
        ),
        candidate("pip", Tier::A, remove(r"C:\L\pip\cache"), 3),
        blocked,
        candidate("installer", Tier::A, remove(r"C:\Windows\Installer\x"), 1),
    ]
}

fn exclusions() -> ExclusionList {
    ExclusionList::windows_baseline("C:", r"C:\L")
}

#[test]
fn plan_groups_selected_candidates_by_tier_in_execution_order() {
    let plan =
        Plan::from_selection("C:", &sample(), &["dism", "pip", "npm"], &exclusions()).unwrap();
    assert_eq!(plan.volume(), "C:");
    assert_eq!(plan.tiers(), vec![Tier::A, Tier::D]);
    let a: Vec<_> = plan.items(Tier::A).iter().map(|i| i.id.as_str()).collect();
    assert_eq!(a, ["npm", "pip"]); // ordem do catálogo, não da seleção
    assert!(plan.items(Tier::B).is_empty());
    assert_eq!(plan.item_count(), 3);
    assert_eq!(plan.estimated_size(Tier::A), ByteSize::from_bytes(13));
    assert_eq!(plan.estimated_total(), ByteSize::from_bytes(20));
}

#[test]
fn plan_rejects_unknown_blocked_excluded_duplicate_and_empty_selection() {
    let c = sample();
    let ex = exclusions();
    assert_eq!(
        Plan::from_selection("C:", &c, &["nope"], &ex),
        Err(PlanError::UnknownCandidate("nope".into()))
    );
    assert_eq!(
        Plan::from_selection("C:", &c, &["cuda"], &ex),
        Err(PlanError::Blocked {
            id: "cuda".into(),
            reason: disk_cleanup_domain::BlockReason::EnvVar {
                name: "CUDA_PATH".into()
            }
        })
    );
    assert!(matches!(
        Plan::from_selection("C:", &c, &["installer"], &ex),
        Err(PlanError::Excluded { ref id, .. }) if id == "installer"
    ));
    assert_eq!(
        Plan::from_selection("C:", &c, &["npm", "npm"], &ex),
        Err(PlanError::Duplicate("npm".into()))
    );
    assert_eq!(
        Plan::from_selection("C:", &c, &[], &ex),
        Err(PlanError::Empty)
    );
}

#[test]
fn plan_checks_also_remove_paths_against_exclusions() {
    let c = vec![candidate(
        "chatrtx",
        Tier::B,
        Action::Uninstall {
            display_name: "ChatRTX".into(),
            also_remove: vec![r"C:\ProgramData\Package Cache\x".into()],
        },
        1,
    )];
    assert!(matches!(
        Plan::from_selection("C:", &c, &["chatrtx"], &exclusions()),
        Err(PlanError::Excluded { .. })
    ));
}

#[test]
fn action_reports_the_paths_it_touches_and_its_kind() {
    assert_eq!(remove("x").touched_paths(), vec!["x"]);
    assert_eq!(remove("x").kind(), "path");
    let cmd = Action::Command {
        command: "c".into(),
    };
    assert!(cmd.touched_paths().is_empty());
    assert_eq!(cmd.kind(), "command");
    let un = Action::Uninstall {
        display_name: "d".into(),
        also_remove: vec!["p".into()],
    };
    assert_eq!(un.touched_paths(), vec!["p"]);
    assert_eq!(un.kind(), "uninstall");
    assert!(Availability::Selectable.is_selectable());
    assert!(!Availability::Blocked {
        reason: disk_cleanup_domain::BlockReason::PathEntry { entry: "r".into() }
    }
    .is_selectable());
}

fn decisions() -> Vec<Decision> {
    vec![
        Decision::new(
            "as",
            "Qual Android Studio fica?",
            vec!["2024.3".into(), "2025.3".into()],
            Some(0),
        ),
        Decision::new(
            "games",
            "Jogos?",
            vec!["Manter".into(), "Revisar".into()],
            None,
        ),
    ]
}

#[test]
fn decision_choice_is_validated() {
    let mut d = decisions().remove(1);
    assert!(!d.is_decided());
    assert_eq!(
        d.choose(5),
        Err(DomainError::InvalidChoice {
            decision: "games".into(),
            index: 5
        })
    );
    d.choose(1).unwrap();
    assert!(d.is_decided());
    assert_eq!(d.chosen_option(), Some("Revisar"));
    assert_eq!(d.recommended(), None);
    assert_eq!(decisions()[0].recommended(), Some(0));
}

#[test]
fn approval_requires_decisions_tiers_and_acknowledgement() {
    let plan = Plan::from_selection("C:", &sample(), &["npm", "dism"], &exclusions()).unwrap();
    let mut ds = decisions();
    let tiers: BTreeSet<_> = [Tier::A].into();

    assert_eq!(
        approve(&plan, &ds, &tiers, true),
        Err(ApprovalError::PendingDecisions(vec![
            "as".into(),
            "games".into()
        ]))
    );
    ds[0].choose(0).unwrap();
    ds[1].choose(0).unwrap();
    assert_eq!(
        approve(&plan, &ds, &BTreeSet::new(), true),
        Err(ApprovalError::NoTierApproved)
    );
    assert_eq!(
        approve(&plan, &ds, &tiers, false),
        Err(ApprovalError::NotAcknowledged)
    );
    assert_eq!(
        approve(&plan, &ds, &[Tier::C].into(), true),
        Err(ApprovalError::TierNotInPlan(Tier::C))
    );

    let approved = approve(&plan, &ds, &tiers, true).unwrap();
    assert_eq!(approved.plan().tiers(), vec![Tier::A]);
    assert_eq!(approved.plan().item_count(), 1);
}

#[test]
fn errors_have_human_readable_messages() {
    assert!(PlanError::Empty.to_string().contains("nenhum"));
    assert!(ApprovalError::PendingDecisions(vec!["x".into()])
        .to_string()
        .contains("x"));
    assert!(ApprovalError::TierNotInPlan(Tier::B)
        .to_string()
        .contains('B'));
}

#[test]
fn plan_from_parts_rebuilds_a_plan_and_drops_empty_tiers() {
    use disk_cleanup_domain::PlanItem;
    let item = PlanItem {
        id: "npm".into(),
        label: disk_cleanup_domain::LocalizedText::same("npm"),
        action: remove(r"C:\L\npm-cache"),
        estimated: ByteSize::from_bytes(4),
    };
    let plan = Plan::from_parts("C:", [(Tier::A, vec![item]), (Tier::B, vec![])].into());
    assert_eq!(plan.tiers(), vec![Tier::A]);
    assert_eq!(plan.estimated_total(), ByteSize::from_bytes(4));
}
