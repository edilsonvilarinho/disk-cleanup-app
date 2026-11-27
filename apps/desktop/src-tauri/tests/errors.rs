use disk_cleanup_application::{AppError, PortError};
use disk_cleanup_desktop_lib::ErrorDto;
use disk_cleanup_domain::{
    ApprovalError, BlockReason, DomainError, LocalizedText, PlanError, Tier,
};

fn code(e: ErrorDto) -> (String, Vec<(String, String)>) {
    (e.code, e.params.into_iter().collect())
}

fn p(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
    pairs
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

/// (erro convertido, código esperado, parâmetros esperados)
type Case = (ErrorDto, &'static str, Vec<(String, String)>);

#[test]
fn every_core_error_becomes_a_stable_code_with_params() {
    let cases: Vec<Case> = vec![
        (
            AppError::InvalidDepth(3).into(),
            "invalid_depth",
            p(&[("depth", "3")]),
        ),
        (
            AppError::TierNotApproved(Tier::C).into(),
            "tier_not_approved",
            p(&[("tier", "C")]),
        ),
        (
            PortError::Io("x".into()).into(),
            "io",
            p(&[("detail", "x")]),
        ),
        (
            PortError::NotFound("p".into()).into(),
            "not_found",
            p(&[("detail", "p")]),
        ),
        (
            PortError::InvalidData("d".into()).into(),
            "invalid_data",
            p(&[("detail", "d")]),
        ),
        (
            PortError::Unsupported("u".into()).into(),
            "unsupported",
            p(&[("detail", "u")]),
        ),
        (
            AppError::Port(PortError::Io("y".into())).into(),
            "io",
            p(&[("detail", "y")]),
        ),
        (
            DomainError::UnknownTier("Z".into()).into(),
            "unknown_tier",
            p(&[("value", "Z")]),
        ),
        (
            DomainError::UnknownDisposal("lixo".into()).into(),
            "unknown_disposal",
            p(&[("value", "lixo")]),
        ),
        (
            DomainError::InvalidVolume("v".into()).into(),
            "invalid_volume",
            p(&[("detail", "v")]),
        ),
        (
            DomainError::InvalidChoice {
                decision: "d".into(),
                index: 2,
            }
            .into(),
            "invalid_choice",
            p(&[("decision", "d"), ("index", "2")]),
        ),
        (
            AppError::Domain(DomainError::UnknownTier("Q".into())).into(),
            "unknown_tier",
            p(&[("value", "Q")]),
        ),
        (PlanError::Empty.into(), "plan_empty", p(&[])),
        (
            PlanError::UnknownCandidate("a".into()).into(),
            "plan_unknown_candidate",
            p(&[("id", "a")]),
        ),
        (
            PlanError::Duplicate("a".into()).into(),
            "plan_duplicate",
            p(&[("id", "a")]),
        ),
        (
            PlanError::Blocked {
                id: "a".into(),
                reason: BlockReason::EnvVar { name: "X".into() },
            }
            .into(),
            "plan_blocked",
            p(&[("id", "a")]),
        ),
        (
            PlanError::Excluded {
                id: "a".into(),
                path: "/p".into(),
                reason: LocalizedText::same("r"),
            }
            .into(),
            "plan_excluded",
            p(&[("id", "a"), ("path", "/p")]),
        ),
        (
            AppError::Plan(PlanError::Empty).into(),
            "plan_empty",
            p(&[]),
        ),
        (
            ApprovalError::PendingDecisions(vec!["a".into(), "b".into()]).into(),
            "approval_pending",
            p(&[("ids", "a, b")]),
        ),
        (
            ApprovalError::NoTierApproved.into(),
            "approval_no_tier",
            p(&[]),
        ),
        (
            ApprovalError::NotAcknowledged.into(),
            "approval_not_acknowledged",
            p(&[]),
        ),
        (
            ApprovalError::TierNotInPlan(Tier::B).into(),
            "approval_tier_not_in_plan",
            p(&[("tier", "B")]),
        ),
        (
            ErrorDto::new("classification_required"),
            "classification_required",
            p(&[]),
        ),
        (
            ErrorDto::new("tier_already_run").with("tier", "A"),
            "tier_already_run",
            p(&[("tier", "A")]),
        ),
    ];
    for (dto, expected, params) in cases {
        let (c, ps) = code(dto);
        assert_eq!((c.as_str(), ps), (expected, params));
    }
    let json = serde_json::to_value(ErrorDto::new("x").with("k", "v")).unwrap();
    assert_eq!(json, serde_json::json!({"code": "x", "params": {"k": "v"}}));
}
