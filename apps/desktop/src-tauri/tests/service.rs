use std::cell::RefCell;

use disk_cleanup_application::{
    Catalog, CatalogRepository, CatalogRule, Environment, FileRecord, FileWalker, PathInspector,
    PortError, RuleTarget, VolumeInfo, WalkStats,
};
use disk_cleanup_desktop_lib::{
    build_plan, classify, run_survey, system_info, CallbackProgress, Session, SurveyRequestDto,
};
use disk_cleanup_domain::{path_components, ByteSize, ExclusionList, Risk, Tier, VolumeUsage};
use disk_cleanup_infrastructure::{SkillPlanJsonCodec, SnapshotEnvironment};

struct Walker;
impl FileWalker for Walker {
    fn walk(&self, _root: &str, sink: &mut dyn FnMut(FileRecord)) -> Result<WalkStats, PortError> {
        for (p, l, a) in [
            (r"C:\Users\u\OneDrive\x", 600u64, 60u64),
            (r"C:\Windows\y", 300, 300),
        ] {
            sink(FileRecord {
                components: path_components(p),
                logical: ByteSize::from_bytes(l),
                allocated: ByteSize::from_bytes(a),
            });
        }
        Ok(WalkStats {
            files: 2,
            unreadable: 1,
        })
    }
}

struct Volume;
impl VolumeInfo for Volume {
    fn usage(&self, _: &str) -> Result<VolumeUsage, PortError> {
        Ok(VolumeUsage::new(ByteSize::from_bytes(10_000), ByteSize::from_bytes(500)).unwrap())
    }
}

struct Inspector;
impl PathInspector for Inspector {
    fn exists(&self, path: &str) -> bool {
        !path.contains("nada")
    }
    fn size_of(&self, _: &str) -> Result<ByteSize, PortError> {
        Ok(ByteSize::from_bytes(2048))
    }
}

struct Catalogue;
impl CatalogRepository for Catalogue {
    fn load(&self) -> Result<Catalog, PortError> {
        let rule = |id: &str, tier, path: &str| CatalogRule {
            id: id.into(),
            label: id.into(),
            tier,
            risk: Risk::Redownload,
            note: "n".into(),
            target: RuleTarget::Path { path: path.into() },
            watch_env: vec!["CUDA_PATH".into()],
        };
        Ok(Catalog {
            rules: vec![
                rule("npm", Tier::A, r"C:\L\npm-cache"),
                rule("cuda", Tier::C, r"C:\cuda"),
                rule("ausente", Tier::A, r"C:\nada"),
                CatalogRule {
                    target: RuleTarget::Command {
                        command: "pip cache purge".into(),
                        measure: r"C:\L\pip".into(),
                    },
                    ..rule("pip", Tier::A, "")
                },
            ],
            exclusions: vec![],
        })
    }
}

fn env() -> SnapshotEnvironment {
    SnapshotEnvironment::from_pairs(vec![
        ("SystemDrive".into(), "C:".into()),
        ("USERPROFILE".into(), r"C:\Users\u".into()),
        ("CUDA_PATH".into(), r"C:\cuda".into()),
    ])
}

#[test]
fn system_info_derives_volume_root_and_profile_per_os() {
    let windows = system_info(&env(), "windows");
    assert_eq!(windows.os, "windows");
    assert_eq!(windows.volume_root, r"C:\");
    assert_eq!(windows.profile.as_deref(), Some(r"C:\Users\u"));
    assert_eq!(windows.catalog, "windows");

    let linux = system_info(
        &SnapshotEnvironment::from_pairs(vec![("HOME".into(), "/home/u".into())]),
        "linux",
    );
    assert_eq!(linux.volume_root, "/");
    assert_eq!(linux.profile.as_deref(), Some("/home/u"));

    let bare = system_info(&SnapshotEnvironment::from_pairs(vec![]), "windows");
    assert_eq!(bare.volume_root, r"C:\");
    assert_eq!(bare.profile, None);
}

#[test]
fn survey_maps_report_to_camel_case_dto_and_reports_progress() {
    let seen = RefCell::new(Vec::new());
    let progress = CallbackProgress::new(|files, bytes| seen.borrow_mut().push((files, bytes)));
    let request = SurveyRequestDto {
        volume_root: r"C:\".into(),
        profile: Some(r"C:\Users\u".into()),
        depth: 2,
    };
    let dto = run_survey(&Walker, &Volume, &progress, &request).unwrap();

    assert_eq!(dto.volume.total_bytes, 10_000);
    assert_eq!(dto.volume.used_bytes, 9_500);
    assert_eq!(dto.volume.health, "critical");
    assert_eq!(dto.roots[0].name, "Users");
    assert_eq!(dto.roots[0].key, ["Users"]);
    assert_eq!(dto.cloud[0].placeholder_bytes, 540);
    assert!(dto.cloud[0].is_cloud);
    assert_eq!(dto.children.len(), 2);
    assert_eq!(dto.profile[0].name, "OneDrive");
    assert_eq!((dto.files, dto.unreadable), (2, 1));
    assert_eq!(dto.unattributed_bytes, 9_500 - 360);
    assert_eq!(*seen.borrow(), vec![(2, 900)]);
    assert_eq!(format!("{progress:?}"), "CallbackProgress");

    let json = serde_json::to_value(&dto).unwrap();
    assert!(json["volume"]["usedPercent"].is_number());
    assert!(json["roots"][0]["logicalBytes"].is_number());
    assert!(json.get("elapsedMs").is_some());

    let bad = SurveyRequestDto {
        depth: 5,
        ..request
    };
    assert!(run_survey(&Walker, &Volume, &progress, &bad)
        .unwrap_err()
        .contains("profundidade"));
}

#[test]
fn classification_is_stored_in_session_and_feeds_the_plan() {
    let session = Session::default();
    assert!(
        build_plan(&session, "C:", &["npm".into()], &SkillPlanJsonCodec)
            .unwrap_err()
            .contains("classificação")
    );

    let dto = classify(
        &session,
        &Catalogue,
        &env(),
        &Inspector,
        ExclusionList::default(),
    )
    .unwrap();
    let ids: Vec<_> = dto.candidates.iter().map(|c| c.id.as_str()).collect();
    assert_eq!(ids, ["npm", "cuda", "pip"]);
    assert_eq!(dto.candidates[0].kind, "path");
    assert_eq!(dto.candidates[0].target, r"C:\L\npm-cache");
    assert_eq!(dto.candidates[0].risk, "redownload");
    assert_eq!(dto.candidates[0].tier, "A");
    assert_eq!(dto.candidates[0].blocked_reason, None);
    assert!(dto.candidates[1]
        .blocked_reason
        .as_deref()
        .unwrap()
        .contains("CUDA_PATH"));
    assert_eq!(dto.candidates[2].kind, "command");
    assert_eq!(dto.candidates[2].target, "pip cache purge");
    assert_eq!(dto.skipped[0].id, "ausente");
    assert!(dto.skipped[0].reason.contains("não existe"));
    assert_eq!(dto.selectable_bytes, 4096);

    let plan = build_plan(
        &session,
        "C:",
        &["pip".into(), "npm".into()],
        &SkillPlanJsonCodec,
    )
    .unwrap();
    assert_eq!(plan.item_count, 2);
    assert_eq!(plan.estimated_bytes, 4096);
    assert_eq!(plan.tiers[0].tier, "A");
    assert_eq!(plan.tiers[0].item_count, 2);
    assert!(plan.json.contains("\"volume\": \"C:\""));

    assert!(
        build_plan(&session, "C:", &["cuda".into()], &SkillPlanJsonCodec)
            .unwrap_err()
            .contains("bloqueado")
    );
}

#[test]
fn classification_errors_are_returned_as_messages() {
    struct Broken;
    impl CatalogRepository for Broken {
        fn load(&self) -> Result<Catalog, PortError> {
            Err(PortError::InvalidData("x".into()))
        }
    }
    let err = classify(
        &Session::default(),
        &Broken,
        &env(),
        &Inspector,
        ExclusionList::default(),
    )
    .unwrap_err();
    assert!(err.contains("dados inválidos"));
}

#[test]
fn uninstall_and_other_risks_are_serialized() {
    use disk_cleanup_desktop_lib::CandidateDto;
    use disk_cleanup_domain::{Action, Availability, Candidate};
    let c = Candidate {
        id: "x".into(),
        label: "X".into(),
        tier: Tier::B,
        action: Action::Uninstall {
            display_name: "App".into(),
            also_remove: vec![],
        },
        size: ByteSize::from_bytes(1),
        risk: Risk::Low,
        note: String::new(),
        availability: Availability::Selectable,
    };
    let dto = CandidateDto::from(&c);
    assert_eq!(
        (dto.kind.as_str(), dto.target.as_str(), dto.risk),
        ("uninstall", "App", "low")
    );
    let none = CandidateDto::from(&Candidate {
        risk: Risk::None,
        ..c.clone()
    });
    assert_eq!(none.risk, "none");
    let long = CandidateDto::from(&Candidate {
        risk: Risk::LongRunning,
        ..c
    });
    assert_eq!(long.risk, "long-running");
    let _ = env().var("x");
}
