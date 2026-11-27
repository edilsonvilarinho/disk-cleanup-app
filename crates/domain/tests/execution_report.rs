use disk_cleanup_domain::{
    signed_delta, ByteSize, CleanupReport, ItemResult, ItemStatus, SafetyGuard, Tier, TierRun,
    VolumeUsage,
};

fn b(n: u64) -> ByteSize {
    ByteSize::from_bytes(n)
}

fn item(
    id: &str,
    tier: Tier,
    before: u64,
    after: u64,
    estimated: u64,
    status: ItemStatus,
) -> ItemResult {
    ItemResult {
        id: id.into(),
        label: disk_cleanup_domain::LocalizedText::same(&id.to_uppercase()),
        tier,
        estimated: b(estimated),
        free_before: b(before),
        free_after: b(after),
        status,
        trashed: ByteSize::ZERO,
    }
}

#[test]
fn signed_delta_is_positive_when_space_is_freed_and_negative_otherwise() {
    assert_eq!(signed_delta(b(100), b(160)), 60);
    assert_eq!(signed_delta(b(160), b(100)), -60);
    assert_eq!(signed_delta(b(0), b(u64::MAX)), i64::MAX);
}

#[test]
fn tier_run_sums_freed_estimated_and_lists_pending_items() {
    let run = TierRun {
        tier: Tier::A,
        free_before: b(1_000),
        free_after: b(1_090),
        items: vec![
            item("npm", Tier::A, 1_000, 1_060, 60, ItemStatus::Done),
            item(
                "dx",
                Tier::A,
                1_060,
                1_090,
                40,
                ItemStatus::Partial {
                    remaining: b(10),
                    detail: Some("em uso".into()),
                },
            ),
        ],
    };
    assert_eq!(run.freed(), 90);
    assert_eq!(run.estimated(), b(100));
    assert_eq!(run.items[0].freed(), 60);
    assert_eq!(run.pending().len(), 1);
    assert_eq!(run.pending()[0].id, "dx");
}

#[test]
fn report_compares_before_and_after_and_aggregates_tiers() {
    let initial = VolumeUsage::new(b(1_000), b(100)).unwrap();
    let a = TierRun {
        tier: Tier::A,
        free_before: b(100),
        free_after: b(250),
        items: vec![item("npm", Tier::A, 100, 250, 140, ItemStatus::Done)],
    };
    let c = TierRun {
        tier: Tier::C,
        free_before: b(250),
        free_after: b(300),
        items: vec![item(
            "gradle",
            Tier::C,
            250,
            300,
            80,
            ItemStatus::Failed {
                cause: disk_cleanup_domain::FailCause::Io("acesso negado".into()),
            },
        )],
    };
    let report = CleanupReport::new(initial, vec![a, c], initial.with_free(b(300)));
    assert_eq!(report.freed(), 200);
    assert_eq!(report.initial().used_percent(), 90.0);
    assert_eq!(report.last().used_percent(), 70.0);
    assert_eq!(report.runs().len(), 2);
    assert_eq!(report.estimated(), b(220));
    assert_eq!(report.item_count(), 2);
    assert_eq!(
        report
            .pending()
            .iter()
            .map(|i| i.id.as_str())
            .collect::<Vec<_>>(),
        ["gradle"]
    );
}

#[test]
fn trashed_bytes_are_counted_apart_from_freed_space() {
    // Ir para a Lixeira não libera espaço no volume: o relatório separa os dois.
    let mut gradle = item("gradle", Tier::C, 300, 300, 80, ItemStatus::Done);
    gradle.trashed = b(80);
    let mut maven = item("maven", Tier::C, 300, 300, 30, ItemStatus::Done);
    maven.trashed = b(25);
    let run = TierRun {
        tier: Tier::C,
        free_before: b(300),
        free_after: b(300),
        items: vec![gradle, maven],
    };
    assert_eq!(run.items[0].trashed, b(80));
    assert_eq!(run.trashed(), b(105));
    assert_eq!(run.freed(), 0);
    let a = TierRun {
        tier: Tier::A,
        free_before: b(100),
        free_after: b(300),
        items: vec![item("npm", Tier::A, 100, 300, 200, ItemStatus::Done)],
    };
    assert_eq!(a.trashed(), ByteSize::ZERO);
    let initial = VolumeUsage::new(b(1_000), b(100)).unwrap();
    let report = CleanupReport::new(initial, vec![a, run], initial.with_free(b(300)));
    assert_eq!(report.trashed(), b(105));
    assert_eq!(report.freed(), 200);
}

#[test]
fn safety_guard_refuses_broad_and_protected_targets() {
    let guard = SafetyGuard::new(vec![
        r"C:\Users\u".into(),
        r"C:\Users\u\AppData\Local".into(),
        String::new(),
    ]);
    for path in [
        r"C:\",
        r"C:\Users",
        r"C:\Users\u",
        r"c:\users\U\appdata\local",
        "",
        "/home",
    ] {
        assert!(guard.check(path).is_err(), "deveria recusar {path:?}");
    }
    assert!(guard.check(r"C:\Users\u\AppData\Local\npm-cache").is_ok());
    assert!(guard.check("/home/u/.cache/pip").is_ok());
}
