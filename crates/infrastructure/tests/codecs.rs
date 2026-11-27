use std::io::Write;

use disk_cleanup_application::{CatalogRepository, PlanCodec, PortError, RuleTarget};
use disk_cleanup_domain::{
    Action, Availability, ByteSize, Candidate, ExclusionList, LocalizedText, Plan, Risk, Tier,
};
use disk_cleanup_infrastructure::{catalog_for, SkillPlanJsonCodec, TomlCatalogRepository};

const CATALOG: &str = r#"
[[exclusion]]
pattern = 'D:\Backups'
reason = "backups"
reason_en = "user backups"

[[rule]]
id = "npm-cache"
label = "npm cache"
tier = "A"
risk = "none"
note = "comando oficial"
note_en = "official command"
kind = "command"
command = "npm cache clean --force"
measure = '%LOCALAPPDATA%\npm-cache'

[[rule]]
id = "cuda"
label = "CUDA"
tier = "c"
risk = "redownload"
kind = "path"
path = 'C:\cuda'
watch_env = ["CUDA_PATH"]

[[rule]]
id = "dism"
label = "DISM"
tier = "D"
risk = "long-running"
kind = "command"
command = "DISM /Online /Cleanup-Image /StartComponentCleanup"
measure = 'C:\Windows\WinSxS'

[[rule]]
id = "nsight"
label = "Nsight"
tier = "B"
risk = "low"
kind = "path"
path = 'C:\nsight'
"#;

#[test]
fn toml_catalog_parses_rules_exclusions_and_defaults() {
    let catalog = TomlCatalogRepository::from_text(CATALOG).load().unwrap();
    assert_eq!(catalog.rules.len(), 4);
    assert_eq!(
        catalog.exclusions[0].reason,
        LocalizedText::new("backups", "user backups")
    );
    let npm = &catalog.rules[0];
    assert_eq!(npm.tier, Tier::A);
    assert_eq!(npm.risk, Risk::None);
    assert_eq!(npm.label, LocalizedText::same("npm cache"));
    assert_eq!(
        npm.note,
        LocalizedText::new("comando oficial", "official command")
    );
    assert_eq!(
        npm.target,
        RuleTarget::Command {
            command: "npm cache clean --force".into(),
            measure: r"%LOCALAPPDATA%\npm-cache".into()
        }
    );
    let cuda = &catalog.rules[1];
    assert_eq!((cuda.tier, cuda.risk), (Tier::C, Risk::Redownload));
    assert_eq!(cuda.watch_env, ["CUDA_PATH"]);
    assert_eq!(cuda.note, LocalizedText::default());
    assert_eq!(catalog.rules[2].risk, Risk::LongRunning);
    assert_eq!(catalog.rules[3].risk, Risk::Low);
}

#[test]
fn toml_catalog_rejects_invalid_content_with_rule_context() {
    let bad = |text: &str| match TomlCatalogRepository::from_text(text).load() {
        Err(PortError::InvalidData(msg)) => msg,
        other => panic!("esperava InvalidData, veio {other:?}"),
    };
    assert!(bad("[[rule]]\nid = 1").contains("TOML"));
    let base = "[[rule]]\nid = \"x\"\nlabel = \"x\"\n";
    assert!(bad(&format!(
        "{base}tier = \"Z\"\nrisk = \"none\"\nkind = \"path\"\npath = \"p\""
    ))
    .contains("'x'"));
    assert!(bad(&format!(
        "{base}tier = \"A\"\nrisk = \"talvez\"\nkind = \"path\"\npath = \"p\""
    ))
    .contains("risco"));
    assert!(bad(&format!(
        "{base}tier = \"A\"\nrisk = \"none\"\nkind = \"path\""
    ))
    .contains("path"));
    assert!(bad(&format!(
        "{base}tier = \"A\"\nrisk = \"none\"\nkind = \"command\"\ncommand = \"c\""
    ))
    .contains("measure"));
    assert!(bad(&format!(
        "{base}tier = \"A\"\nrisk = \"none\"\nkind = \"uninstall\""
    ))
    .contains("uninstall"));
    let dup = format!("{base}tier = \"A\"\nrisk = \"none\"\nkind = \"path\"\npath = \"p\"\n");
    assert!(bad(&format!("{dup}{dup}")).contains("duplicado"));
}

#[test]
fn toml_catalog_loads_from_file_and_reports_missing_file() {
    let mut file = tempfile::NamedTempFile::new().unwrap();
    file.write_all(CATALOG.as_bytes()).unwrap();
    let repo = TomlCatalogRepository::from_file(file.path());
    assert_eq!(repo.load().unwrap().rules.len(), 4);
    let missing = TomlCatalogRepository::from_file(file.path().with_extension("nada"));
    assert!(matches!(missing.load(), Err(PortError::NotFound(_))));
}

#[test]
fn bundled_catalogs_exist_for_the_three_platforms_and_are_bilingual() {
    for (os, minimum) in [("windows", 15), ("linux", 12), ("macos", 12)] {
        let catalog = catalog_for(os).unwrap().load().unwrap();
        assert!(
            catalog.rules.len() >= minimum,
            "{os}: {} regras",
            catalog.rules.len()
        );
        assert!(
            catalog.rules.iter().any(|r| r.tier == Tier::A),
            "{os} sem tier A"
        );
        assert!(
            catalog.rules.iter().any(|r| r.tier == Tier::C),
            "{os} sem tier C"
        );
        for rule in &catalog.rules {
            assert!(
                !rule.label.en.is_empty(),
                "{os}/{}: label sem inglês",
                rule.id
            );
            assert_eq!(
                rule.note.pt.is_empty(),
                rule.note.en.is_empty(),
                "{os}/{}: nota só num idioma",
                rule.id
            );
        }
        for ex in &catalog.exclusions {
            assert!(
                !ex.reason.en.is_empty() && ex.reason.en != ex.reason.pt,
                "{os}: exclusão sem tradução"
            );
        }
    }
    assert!(matches!(
        catalog_for("freebsd"),
        Err(PortError::Unsupported(_))
    ));
}

fn candidate(id: &str, tier: Tier, action: Action) -> Candidate {
    Candidate {
        id: id.into(),
        label: LocalizedText::same(&format!("L {id}")),
        tier,
        action,
        size: ByteSize::from_bytes(1024),
        risk: Risk::None,
        note: LocalizedText::default(),
        availability: Availability::Selectable,
    }
}

fn plan() -> Plan {
    let candidates = vec![
        candidate(
            "npm",
            Tier::A,
            Action::RemovePath {
                path: r"C:\L\npm-cache".into(),
            },
        ),
        candidate(
            "chatrtx",
            Tier::B,
            Action::Uninstall {
                display_name: "NVIDIA ChatRTX".into(),
                also_remove: vec![r"C:\ProgramData\NVIDIA Corporation\ChatRTX".into()],
            },
        ),
        candidate(
            "dism",
            Tier::D,
            Action::Command {
                command: "DISM /Online".into(),
            },
        ),
    ];
    Plan::from_selection(
        "C:",
        &candidates,
        &["npm", "chatrtx", "dism"],
        &ExclusionList::default(),
    )
    .unwrap()
}

#[test]
fn plan_json_uses_the_skill_format_and_round_trips() {
    let codec = SkillPlanJsonCodec;
    let text = codec.encode(&plan()).unwrap();
    let json: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert_eq!(json["volume"], "C:");
    assert_eq!(json["tiers"]["A"][0]["kind"], "path");
    assert_eq!(json["tiers"]["A"][0]["action"], "remove");
    assert_eq!(json["tiers"]["A"][0]["path"], r"C:\L\npm-cache");
    assert_eq!(json["tiers"]["A"][0]["estimatedBytes"], 1024);
    assert_eq!(json["tiers"]["B"][0]["displayName"], "NVIDIA ChatRTX");
    assert_eq!(
        json["tiers"]["B"][0]["alsoRemove"][0],
        r"C:\ProgramData\NVIDIA Corporation\ChatRTX"
    );
    assert_eq!(json["tiers"]["D"][0]["command"], "DISM /Online");
    assert_eq!(codec.decode(&text).unwrap(), plan());
}

#[test]
fn plan_json_decode_accepts_skill_files_without_estimates_and_rejects_bad_input() {
    let codec = SkillPlanJsonCodec;
    let skill = r#"{"volume":"C:","tiers":{"A":[{"id":"x","kind":"path","label":"X","path":"C:\\x","action":"remove"}],"C":[]}}"#;
    let plan = codec.decode(skill).unwrap();
    assert_eq!(plan.items(Tier::A)[0].estimated, ByteSize::ZERO);
    assert_eq!(plan.tiers(), vec![Tier::A]);
    assert!(matches!(codec.decode("{"), Err(PortError::InvalidData(_))));
    assert!(
        matches!(codec.decode(r#"{"volume":"C:","tiers":{"Z":[]}}"#), Err(PortError::InvalidData(m)) if m.contains("Z"))
    );
}

#[test]
fn toml_catalog_parses_project_profiles_and_roots() {
    let text = r#"
[[project_root]]
path = '%USERPROFILE%\workspace'

[[project]]
id = "node"
label = "Node.js"
markers = ["package.json"]
artifacts = ["node_modules", ".next"]
note = "npm install recria"
note_en = "npm install recreates"
"#;
    let catalog = TomlCatalogRepository::from_text(text).load().unwrap();
    assert_eq!(
        catalog.project_roots,
        vec![r"%USERPROFILE%\workspace".to_string()]
    );
    let node = &catalog.projects[0];
    assert_eq!(
        (node.id.as_str(), node.label.en.as_str()),
        ("node", "Node.js")
    );
    assert_eq!(node.markers, vec!["package.json".to_string()]);
    assert_eq!(
        node.artifacts,
        vec!["node_modules".to_string(), ".next".to_string()]
    );
    assert_eq!(node.note.en, "npm install recreates");

    let bad = |text: &str| match TomlCatalogRepository::from_text(text).load() {
        Err(PortError::InvalidData(msg)) => msg,
        other => panic!("esperava InvalidData, veio {other:?}"),
    };
    let p = |markers: &str, artifacts: &str| {
        format!("[[project]]\nid = \"p\"\nlabel = \"P\"\nmarkers = {markers}\nartifacts = {artifacts}\n")
    };
    assert!(bad(&p("[]", "[\"x\"]")).contains("marcador"));
    assert!(bad(&p("[\"m\"]", "[]")).contains("artefato"));
    // Artefato é um nome dentro da raiz: nunca caminho, nunca "..".
    for evil in ["\"..\"", "\"a/b\"", "'a\\b'", "\".\"", "\"\""] {
        assert!(
            bad(&p("[\"m\"]", &format!("[{evil}]"))).contains("artefato"),
            "{evil}"
        );
    }
    let ok = p("[\"m\"]", "[\"x\"]");
    assert!(bad(&format!("{ok}{ok}")).contains("duplicado"));
}

#[test]
fn bundled_catalogs_have_project_profiles_and_roots() {
    for os in ["windows", "linux", "macos"] {
        let catalog = catalog_for(os).unwrap().load().unwrap();
        let ids: Vec<_> = catalog.projects.iter().map(|p| p.id.as_str()).collect();
        for id in ["node", "rust", "python", "gradle", "maven", "dotnet"] {
            assert!(ids.contains(&id), "{os} sem perfil {id}");
        }
        assert!(
            !catalog.project_roots.is_empty(),
            "{os} sem pastas de projetos"
        );
        for p in &catalog.projects {
            assert!(
                !p.note.en.is_empty() && p.note.en != p.note.pt,
                "{os}/{}: nota sem inglês",
                p.id
            );
        }
    }
}

/// Nenhuma regra embutida pode conter (ou cair dentro de) uma exclusão: o
/// endurecimento de `conflicting` não pode tirar alvos legítimos do catálogo.
#[test]
fn bundled_rules_never_touch_an_exclusion_after_expansion() {
    use disk_cleanup_application::expand_template;
    use disk_cleanup_infrastructure::{exclusions_for, SnapshotEnvironment};
    let env = SnapshotEnvironment::from_pairs(
        [
            ("SystemDrive", "C:"),
            ("SystemRoot", r"C:\Windows"),
            ("USERPROFILE", r"C:\Users\u"),
            ("LOCALAPPDATA", r"C:\Users\u\AppData\Local"),
            ("APPDATA", r"C:\Users\u\AppData\Roaming"),
            ("ProgramData", r"C:\ProgramData"),
            ("ProgramFiles", r"C:\Program Files"),
            ("ProgramFiles(x86)", r"C:\Program Files (x86)"),
            ("TEMP", r"C:\Users\u\AppData\Local\Temp"),
            ("HOME", "/home/u"),
        ]
        .iter()
        .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
        .collect(),
    );
    for os in ["windows", "linux", "macos"] {
        let catalog = catalog_for(os).unwrap().load().unwrap();
        let exclusions = catalog
            .exclusions
            .iter()
            .fold(exclusions_for(os, &env), |l, e| {
                l.with(
                    &expand_template(&e.pattern, &env).unwrap_or_else(|_| e.pattern.clone()),
                    e.reason.clone(),
                )
            });
        for rule in &catalog.rules {
            let Ok(path) = expand_template(rule.target.measured_template(), &env) else {
                continue;
            };
            assert!(
                exclusions.conflicting(&path).is_none(),
                "{os}/{}: {path} toca a exclusão {:?}",
                rule.id,
                exclusions.conflicting(&path).map(|e| &e.pattern)
            );
        }
    }
}

/// Com a guarda mais estrita (alvo que contém pasta protegida), nenhuma regra
/// de caminho embutida passa a ser recusada na execução.
#[test]
fn bundled_path_rules_pass_the_safety_guard() {
    use disk_cleanup_application::{expand_template, protected_paths_guard, RuleTarget};
    use disk_cleanup_infrastructure::SnapshotEnvironment;
    let env = SnapshotEnvironment::from_pairs(
        [
            ("SystemDrive", "C:"),
            ("SystemRoot", r"C:\Windows"),
            ("USERPROFILE", r"C:\Users\u"),
            ("LOCALAPPDATA", r"C:\Users\u\AppData\Local"),
            ("APPDATA", r"C:\Users\u\AppData\Roaming"),
            ("ProgramData", r"C:\ProgramData"),
            ("ProgramFiles", r"C:\Program Files"),
            ("ProgramFiles(x86)", r"C:\Program Files (x86)"),
            ("TEMP", r"C:\Users\u\AppData\Local\Temp"),
            ("TMP", r"C:\Users\u\AppData\Local\Temp"),
            ("HOME", "/home/u"),
            ("TMPDIR", "/tmp"),
        ]
        .iter()
        .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
        .collect(),
    );
    let guard = protected_paths_guard(&env);
    for os in ["windows", "linux", "macos"] {
        for rule in catalog_for(os).unwrap().load().unwrap().rules {
            let RuleTarget::Path { path } = &rule.target else {
                continue;
            };
            let Ok(path) = expand_template(path, &env) else {
                continue;
            };
            // Conhecido e anterior: `C:\OneDriveTemp` tem 2 segmentos e a guarda
            // exige 3 (`TooBroad`); o item aparece mas é pulado na execução.
            if os == "windows" && rule.id == "onedrive-temp" {
                assert!(guard.check(&path).is_err());
                continue;
            }
            assert!(
                guard.check(&path).is_ok(),
                "{os}/{}: {path} recusado",
                rule.id
            );
        }
    }
}
