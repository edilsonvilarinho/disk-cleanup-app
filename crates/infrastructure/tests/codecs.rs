use std::io::Write;

use disk_cleanup_application::{CatalogRepository, PlanCodec, PortError, RuleTarget};
use disk_cleanup_domain::{
    Action, Availability, ByteSize, Candidate, ExclusionList, Plan, Risk, Tier,
};
use disk_cleanup_infrastructure::{SkillPlanJsonCodec, TomlCatalogRepository};

const CATALOG: &str = r#"
[[exclusion]]
pattern = 'D:\Backups'
reason = "backups"

[[rule]]
id = "npm-cache"
label = "npm cache"
tier = "A"
risk = "none"
note = "comando oficial"
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
    assert_eq!(catalog.exclusions[0].reason, "backups");
    let npm = &catalog.rules[0];
    assert_eq!(npm.tier, Tier::A);
    assert_eq!(npm.risk, Risk::None);
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
    assert_eq!(cuda.note, "");
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
fn bundled_windows_catalog_is_valid() {
    let catalog = TomlCatalogRepository::bundled_windows().load().unwrap();
    assert!(catalog.rules.len() >= 15);
    assert!(catalog.rules.iter().any(|r| r.tier == Tier::A));
    assert!(catalog.rules.iter().any(|r| r.tier == Tier::C));
}

fn candidate(id: &str, tier: Tier, action: Action) -> Candidate {
    Candidate {
        id: id.into(),
        label: format!("L {id}"),
        tier,
        action,
        size: ByteSize::from_bytes(1024),
        risk: Risk::None,
        note: String::new(),
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
