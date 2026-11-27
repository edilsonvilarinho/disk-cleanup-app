use std::cell::RefCell;

use disk_cleanup_application::{
    Catalog, CatalogRepository, CatalogRule, FileRecord, FileWalker, PathInspector, PortError,
    RuleTarget, VolumeInfo, WalkStats,
};
use disk_cleanup_desktop_lib::{
    build_plan, classify, run_survey, system_info, CallbackProgress, CandidateDto, Session,
    SurveyRequestDto,
};
use disk_cleanup_domain::{
    path_components, Action, Availability, BlockReason, ByteSize, Candidate, ExclusionList,
    LocalizedText, Risk, Tier, VolumeUsage,
};
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
                modified: None,
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
            label: LocalizedText::new(&format!("rótulo {id}"), &format!("label {id}")),
            tier,
            risk: Risk::Redownload,
            note: LocalizedText::new("nota", "note"),
            target: RuleTarget::Path { path: path.into() },
            watch_env: vec!["CUDA_PATH".into()],
        };
        Ok(Catalog {
            projects: Vec::new(),
            project_roots: Vec::new(),
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
                rule("excluido", Tier::C, r"C:\Projetos\cache"),
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
    let windows = system_info(&env(), "windows", &Catalogue);
    assert_eq!(
        (windows.os.as_str(), windows.volume_root.as_str()),
        ("windows", r"C:\")
    );
    assert_eq!(windows.profile.as_deref(), Some(r"C:\Users\u"));
    assert_eq!(windows.catalog, "windows");
    let linux = system_info(
        &SnapshotEnvironment::from_pairs(vec![("HOME".into(), "/home/u".into())]),
        "linux",
        &Catalogue,
    );
    assert_eq!(
        (linux.volume_root.as_str(), linux.profile.as_deref()),
        ("/", Some("/home/u"))
    );
    let bare = system_info(
        &SnapshotEnvironment::from_pairs(vec![]),
        "windows",
        &Catalogue,
    );
    assert_eq!((bare.volume_root.as_str(), bare.profile), (r"C:\", None));
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
    assert_eq!(
        (
            dto.volume.total_bytes,
            dto.volume.used_bytes,
            dto.volume.health
        ),
        (10_000, 9_500, "critical")
    );
    assert_eq!(
        (dto.roots[0].name.as_str(), dto.roots[0].key.clone()),
        ("Users", vec!["Users".to_string()])
    );
    assert_eq!(dto.cloud[0].placeholder_bytes, 540);
    assert!(dto.cloud[0].is_cloud);
    assert_eq!(dto.children.len(), 2);
    assert_eq!(
        (dto.files, dto.unreadable, dto.unattributed_bytes),
        (2, 1, 9_500 - 360)
    );
    assert_eq!(*seen.borrow(), vec![(2, 900)]);
    assert_eq!(format!("{progress:?}"), "CallbackProgress");
    let json = serde_json::to_value(&dto).unwrap();
    assert!(json["volume"]["usedPercent"].is_number() && json.get("elapsedMs").is_some());

    let bad = SurveyRequestDto {
        depth: 5,
        ..request
    };
    let err = run_survey(&Walker, &Volume, &progress, &bad).unwrap_err();
    assert_eq!(
        (err.code.as_str(), err.params["depth"].as_str()),
        ("invalid_depth", "5")
    );
}

#[test]
fn classification_is_bilingual_structured_and_feeds_the_plan() {
    let session = Session::default();
    let err = build_plan(&session, "C:", &["npm".into()], &SkillPlanJsonCodec).unwrap_err();
    assert_eq!(err.code, "classification_required");

    let dto = classify(
        &session,
        &Catalogue,
        &env(),
        &Inspector,
        ExclusionList::default(),
        &[r"C:\Projetos".into()],
    )
    .unwrap();
    let ids: Vec<_> = dto.candidates.iter().map(|c| c.id.as_str()).collect();
    assert_eq!(ids, ["npm", "cuda", "pip"]);
    let npm = &dto.candidates[0];
    assert_eq!(
        (npm.label.pt.as_str(), npm.label.en.as_str()),
        ("rótulo npm", "label npm")
    );
    assert_eq!(
        (npm.note.pt.as_str(), npm.note.en.as_str()),
        ("nota", "note")
    );
    assert_eq!(
        (
            npm.kind.as_str(),
            npm.target.as_str(),
            npm.risk,
            npm.tier.as_str()
        ),
        ("path", r"C:\L\npm-cache", "redownload", "A")
    );
    assert!(npm.blocked.is_none());
    let cuda = dto.candidates[1].blocked.as_ref().unwrap();
    assert_eq!((cuda.code, cuda.value.as_str()), ("env_var", "CUDA_PATH"));
    assert_eq!(
        (
            dto.candidates[2].kind.as_str(),
            dto.candidates[2].target.as_str()
        ),
        ("command", "pip cache purge")
    );

    let skipped: Vec<_> = dto
        .skipped
        .iter()
        .map(|s| (s.id.as_str(), s.code, s.detail.clone()))
        .collect();
    assert_eq!(
        skipped[0],
        ("ausente", "not_found", Some(r"C:\nada".to_string()))
    );
    assert_eq!((skipped[1].0, skipped[1].1), ("excluido", "excluded"));
    assert_eq!(
        dto.skipped[1].reason.as_ref().unwrap().en,
        "excluded in Settings"
    );
    assert_eq!(dto.exclusions[0].pattern, r"C:\Projetos");
    assert_eq!(dto.exclusions[0].reason.pt, "excluída nas Configurações");
    assert_eq!(dto.selectable_bytes, 4096);

    let plan = build_plan(
        &session,
        "C:",
        &["pip".into(), "npm".into()],
        &SkillPlanJsonCodec,
    )
    .unwrap();
    assert_eq!(
        (
            plan.item_count,
            plan.estimated_bytes,
            plan.tiers[0].tier.as_str()
        ),
        (2, 4096, "A")
    );
    assert!(plan.json.contains("\"label\": \"rótulo npm\""));
    let err = build_plan(&session, "C:", &["cuda".into()], &SkillPlanJsonCodec).unwrap_err();
    assert_eq!(
        (err.code.as_str(), err.params["id"].as_str()),
        ("plan_blocked", "cuda")
    );
}

#[test]
fn classification_errors_become_codes() {
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
        &[],
    )
    .unwrap_err();
    assert_eq!(err.code, "invalid_data");
}

#[test]
fn every_skip_and_block_code_is_mapped() {
    use disk_cleanup_application::{ClassificationReport, SkipReason, SkippedRule};
    use disk_cleanup_desktop_lib::ClassificationDto;
    let base = Candidate {
        id: "x".into(),
        label: LocalizedText::same("X"),
        tier: Tier::B,
        action: Action::Uninstall {
            display_name: "App".into(),
            also_remove: vec![],
        },
        size: ByteSize::from_bytes(1),
        risk: Risk::Low,
        note: LocalizedText::default(),
        availability: Availability::Blocked {
            reason: BlockReason::PathEntry {
                entry: "/opt/x/bin".into(),
            },
        },
    };
    let dto = CandidateDto::from(&base);
    assert_eq!(
        (dto.kind.as_str(), dto.target.as_str(), dto.risk),
        ("uninstall", "App", "low")
    );
    assert_eq!(
        dto.blocked.as_ref().map(|b| (b.code, b.value.as_str())),
        Some(("path_entry", "/opt/x/bin"))
    );
    assert_eq!(
        CandidateDto::from(&Candidate {
            risk: Risk::None,
            ..base.clone()
        })
        .risk,
        "none"
    );
    assert_eq!(
        CandidateDto::from(&Candidate {
            risk: Risk::LongRunning,
            ..base
        })
        .risk,
        "long-running"
    );

    let report = ClassificationReport {
        projects: vec![],
        large_files: vec![],
        duplicates: vec![],
        candidates: vec![],
        skipped: vec![
            SkippedRule {
                id: "a".into(),
                reason: SkipReason::Empty,
            },
            SkippedRule {
                id: "b".into(),
                reason: SkipReason::UnresolvedVariable("V".into()),
            },
            SkippedRule {
                id: "c".into(),
                reason: SkipReason::Unmeasurable("e".into()),
            },
        ],
        exclusions: ExclusionList::default(),
    };
    let codes: Vec<_> = ClassificationDto::from(&report)
        .skipped
        .into_iter()
        .map(|s| (s.code, s.detail))
        .collect();
    assert_eq!(
        codes,
        vec![
            ("empty", None),
            ("unresolved_variable", Some("V".into())),
            ("unmeasurable", Some("e".into()))
        ]
    );
}

#[test]
fn project_artifacts_carry_project_root_and_idle_days() {
    use disk_cleanup_application::{FoundArtifact, ProjectFinder, ProjectProfile};
    use disk_cleanup_desktop_lib::{classify_projects, ProjectSearch};

    struct Finder;
    impl ProjectFinder for Finder {
        fn find(&self, roots: &[String], _: &[ProjectProfile]) -> Vec<FoundArtifact> {
            assert_eq!(roots, [r"D:\dev".to_string()]);
            vec![FoundArtifact {
                profile: "node".into(),
                project: r"D:\dev\loja".into(),
                path: r"D:\dev\loja\node_modules".into(),
                idle_days: Some(412),
            }]
        }
    }
    struct WithProjects;
    impl CatalogRepository for WithProjects {
        fn load(&self) -> Result<Catalog, PortError> {
            Ok(Catalog {
                projects: vec![ProjectProfile {
                    id: "node".into(),
                    label: LocalizedText::same("Node.js"),
                    markers: vec!["package.json".into()],
                    artifacts: vec!["node_modules".into()],
                    note: LocalizedText::new("npm install recria", "npm install recreates it"),
                }],
                ..Catalog::default()
            })
        }
    }
    let roots = [r"D:\dev".to_string()];
    let search = ProjectSearch {
        finder: &Finder,
        roots: &roots,
    };
    assert!(format!("{search:?}").contains("dev"));
    let dto = classify_projects(
        &Session::default(),
        &WithProjects,
        &env(),
        &Inspector,
        ExclusionList::default(),
        &[],
        Some(search),
    )
    .unwrap();
    let c = &dto.candidates[0];
    assert_eq!(c.id, r"project:D:\dev\loja\node_modules");
    assert_eq!(c.project.as_deref(), Some(r"D:\dev\loja"));
    assert_eq!((c.idle_days, c.tier.as_str()), (Some(412), "C"));
    assert_eq!(c.label.pt, "loja · node_modules");
}

#[test]
fn large_files_from_the_survey_become_file_candidates() {
    use disk_cleanup_desktop_lib::run_survey_in;
    struct Big;
    impl FileWalker for Big {
        fn walk(&self, _: &str, sink: &mut dyn FnMut(FileRecord)) -> Result<WalkStats, PortError> {
            sink(FileRecord {
                components: path_components(r"C:\Users\u\Downloads\ubuntu.iso"),
                logical: ByteSize::from_bytes(1 << 30),
                allocated: ByteSize::from_bytes(1 << 30),
                modified: None,
            });
            Ok(WalkStats {
                files: 1,
                unreadable: 0,
            })
        }
    }
    let session = Session::default();
    let request = SurveyRequestDto {
        volume_root: r"C:\".into(),
        profile: Some(r"C:\Users\u".into()),
        depth: 1,
    };
    run_survey_in(
        &session,
        &Big,
        &Volume,
        &CallbackProgress::new(|_, _| {}),
        &request,
    )
    .unwrap();
    let dto = classify(
        &session,
        &Catalogue,
        &env(),
        &Inspector,
        ExclusionList::default(),
        &[],
    )
    .unwrap();
    assert_eq!(dto.candidates[0].origin, "rule");
    let file = dto.candidates.iter().find(|c| c.origin == "file").unwrap();
    assert_eq!(file.id, r"file:C:\Users\u\Downloads\ubuntu.iso");
    assert_eq!((file.tier.as_str(), file.idle_days), ("D", None));
}

#[test]
fn check_rule_explains_why_a_folder_cannot_be_a_user_rule() {
    use disk_cleanup_desktop_lib::check_rule;
    let env = SnapshotEnvironment::from_pairs(vec![
        ("USERPROFILE".into(), r"C:\Users\u".into()),
        ("LOCALAPPDATA".into(), r"C:\Users\u\AppData\Local".into()),
    ]);
    let baseline = || {
        ExclusionList::default().with(
            r"C:\Windows\Installer",
            LocalizedText::new("msi", "msi cache"),
        )
    };
    let check =
        |path: &str| check_rule(&Catalogue, &env, baseline(), &[r"D:\meus".into()], path).unwrap();
    let ok = check(r"%LOCALAPPDATA%\Teams\Cache");
    assert_eq!(
        (ok.code, ok.detail.as_deref()),
        ("ok", Some(r"C:\Users\u\AppData\Local\Teams\Cache"))
    );
    let ex = check(r"C:\Windows");
    assert_eq!(
        (ex.code, ex.detail.as_deref()),
        ("excluded", Some(r"C:\Windows\Installer"))
    );
    assert_eq!(ex.reason.unwrap().en, "msi cache");
    assert_eq!(check(r"D:\meus\x").code, "excluded");
    assert_eq!(check(r"C:\Users\u\AppData").code, "protected");
    assert_eq!(check(r"C:\Users").code, "too_broad");
    let var = check(r"%NAO_EXISTE%\x");
    assert_eq!(
        (var.code, var.detail.as_deref()),
        ("unresolved_variable", Some("NAO_EXISTE"))
    );
    assert_eq!(check("   ").code, "empty");

    struct Broken;
    impl CatalogRepository for Broken {
        fn load(&self) -> Result<Catalog, PortError> {
            Err(PortError::InvalidData("x".into()))
        }
    }
    assert_eq!(
        check_rule(&Broken, &env, baseline(), &[], r"C:\x\y")
            .unwrap_err()
            .code,
        "invalid_data"
    );
}

#[test]
fn user_rules_and_disabled_profiles_reach_the_classification() {
    use disk_cleanup_application::ProjectProfile;
    use disk_cleanup_desktop_lib::{classify_custom, UserCustomizationDto, UserRuleDto};
    let rule = |label: &str, path: &str, tier: &str| UserRuleDto {
        label: label.into(),
        path: path.into(),
        tier: tier.into(),
    };
    let custom = UserCustomizationDto {
        user_rules: vec![
            rule("Teams", r" C:\Users\u\Teams\Cache ", "a"),
            rule("", r"D:\unity\Library", "C"),
        ],
        disabled_profiles: vec!["node".into()],
    };
    let dto = classify_custom(
        &Session::default(),
        &Catalogue,
        &env(),
        &Inspector,
        ExclusionList::default(),
        &[],
        None,
        &custom,
    )
    .unwrap();
    let teams = dto
        .candidates
        .iter()
        .find(|c| c.id == r"user:C:\Users\u\Teams\Cache")
        .unwrap();
    assert_eq!(
        (teams.tier.as_str(), teams.risk, teams.label.pt.as_str()),
        ("A", "none", "Teams")
    );
    assert_eq!(teams.note.en, "own rule");
    let unity = dto
        .candidates
        .iter()
        .find(|c| c.id == r"user:D:\unity\Library")
        .unwrap();
    assert_eq!(
        (unity.risk, unity.label.pt.as_str()),
        ("redownload", r"D:\unity\Library")
    );

    let bad = |r: UserRuleDto| {
        let custom = UserCustomizationDto {
            user_rules: vec![r],
            ..UserCustomizationDto::default()
        };
        classify_custom(
            &Session::default(),
            &Catalogue,
            &env(),
            &Inspector,
            ExclusionList::default(),
            &[],
            None,
            &custom,
        )
        .unwrap_err()
    };
    assert_eq!(bad(rule("x", " ", "A")).code, "user_rule_path");
    let d = bad(rule("x", r"C:\x\y", "D"));
    assert_eq!(
        (d.code.as_str(), d.params["tier"].as_str()),
        ("user_rule_tier", "D")
    );
    assert_eq!(bad(rule("x", r"C:\x\y", "Q")).code, "unknown_tier");

    // perfis do catálogo chegam ao system_info; catálogo ilegível = nenhum
    struct WithProfile;
    impl CatalogRepository for WithProfile {
        fn load(&self) -> Result<Catalog, PortError> {
            Ok(Catalog {
                projects: vec![ProjectProfile {
                    id: "node".into(),
                    label: LocalizedText::same("Node.js"),
                    markers: vec!["package.json".into()],
                    artifacts: vec!["node_modules".into()],
                    note: LocalizedText::default(),
                }],
                ..Catalog::default()
            })
        }
    }
    let info = system_info(&env(), "windows", &WithProfile);
    assert_eq!(info.project_profiles.len(), 1);
    assert_eq!(
        (
            info.project_profiles[0].id.as_str(),
            info.project_profiles[0].label.en.as_str()
        ),
        ("node", "Node.js")
    );
}

#[test]
fn duplicates_found_in_the_profile_become_duplicate_candidates() {
    use disk_cleanup_application::ContentHasher;
    use disk_cleanup_desktop_lib::find_duplicates;
    struct Copies;
    impl FileWalker for Copies {
        fn walk(
            &self,
            root: &str,
            sink: &mut dyn FnMut(FileRecord),
        ) -> Result<WalkStats, PortError> {
            assert_eq!(root, r"C:\Users\u");
            for (p, m) in [(r"C:\Users\u\a\x.zip", 1), (r"C:\Users\u\b\x.zip", 2)] {
                sink(FileRecord {
                    components: path_components(p),
                    logical: ByteSize::from_bytes(2 << 20),
                    allocated: ByteSize::from_bytes(2 << 20),
                    modified: Some(m),
                });
            }
            Ok(WalkStats {
                files: 2,
                unreadable: 0,
            })
        }
    }
    struct Same;
    impl ContentHasher for Same {
        fn partial(&self, _: &str) -> Result<u64, PortError> {
            Ok(1)
        }
        fn full(&self, _: &str) -> Result<u64, PortError> {
            Ok(2)
        }
        fn equal(&self, _: &str, _: &str) -> Result<bool, PortError> {
            Ok(true)
        }
    }
    let session = Session::default();
    let dto = find_duplicates(&session, &Copies, &Same, &[r"C:\Users\u".into()]).unwrap();
    assert_eq!(dto.groups[0].keep, r"C:\Users\u\a\x.zip");
    assert_eq!(
        dto.groups[0].copies,
        vec![r"C:\Users\u\b\x.zip".to_string()]
    );
    assert_eq!(
        (
            dto.stats.files,
            dto.stats.confirmed,
            dto.groups[0].size_bytes
        ),
        (2, 2, 2 << 20)
    );
    let classified = classify(
        &session,
        &Catalogue,
        &env(),
        &Inspector,
        ExclusionList::default(),
        &[],
    )
    .unwrap();
    let dup = classified
        .candidates
        .iter()
        .find(|c| c.origin == "duplicate")
        .unwrap();
    assert_eq!(dup.id, r"dup:C:\Users\u\b\x.zip");
    assert!(dup.note.pt.contains(r"a\x.zip"));
    assert!(!classified
        .candidates
        .iter()
        .any(|c| c.id.contains(r"\a\x.zip")));
}
