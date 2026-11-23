use disk_cleanup_domain::{
    BlockReason, ExclusionList, FailCause, ItemStatus, LocalizedText, SafetyGuard, SafetyViolation,
    SkipCause, ToolchainGuard,
};

#[test]
fn localized_text_keeps_both_languages() {
    let t = LocalizedText::new("cache do MSI", "MSI cache");
    assert_eq!(
        (t.pt.as_str(), t.en.as_str()),
        ("cache do MSI", "MSI cache")
    );
    assert_eq!(LocalizedText::same("npm"), LocalizedText::new("npm", "npm"));
}

#[test]
fn toolchain_guard_returns_structured_reasons() {
    let guard = ToolchainGuard::new(
        vec![("CUDA_PATH".into(), "/opt/cuda".into())],
        vec!["/opt/go/bin".into()],
    );
    assert_eq!(
        guard.blocking_reason("/opt/cuda", &["CUDA_PATH".into()]),
        Some(BlockReason::EnvVar {
            name: "CUDA_PATH".into()
        })
    );
    assert_eq!(
        guard.blocking_reason("/opt/go", &[]),
        Some(BlockReason::PathEntry {
            entry: "/opt/go/bin".into()
        })
    );
}

#[test]
fn linux_baseline_protects_system_and_secrets() {
    let list = ExclusionList::linux_baseline("/home/u");
    for p in [
        "/proc/1",
        "/sys/kernel",
        "/usr/lib",
        "/etc/fstab",
        "/boot/efi",
        "/var/lib/dpkg/status",
        "/home/u/.ssh/id_ed25519",
        "/home/u/.gnupg",
    ] {
        let hit = list
            .matching(p)
            .unwrap_or_else(|| panic!("deveria excluir {p}"));
        assert!(!hit.reason.pt.is_empty() && !hit.reason.en.is_empty());
    }
    assert!(list.matching("/home/u/.cache/pip").is_none());
}

#[test]
fn macos_baseline_protects_system_icloud_and_device_backups() {
    let list = ExclusionList::macos_baseline("/Users/u");
    for p in [
        "/System/Library",
        "/usr/bin",
        "/Users/u/Library/Keychains/login.keychain-db",
        "/Users/u/Library/Mobile Documents/com~apple~CloudDocs",
        "/Users/u/Library/Application Support/MobileSync/Backup",
    ] {
        assert!(list.matching(p).is_some(), "deveria excluir {p}");
    }
    assert!(list.matching("/Users/u/Library/Caches/pip").is_none());
}

#[test]
fn windows_baseline_reasons_are_bilingual() {
    let list = ExclusionList::windows_baseline("C:", r"C:\L");
    assert!(list
        .entries()
        .iter()
        .all(|e| !e.reason.pt.is_empty() && !e.reason.en.is_empty()));
    assert_eq!(
        list.matching(r"C:\Windows\Installer").unwrap().reason.en,
        "MSI cache; without it uninstalling breaks"
    );
}

#[test]
fn safety_violations_are_structured() {
    let guard = SafetyGuard::new(vec!["/home/u/.local".into()]);
    // `/home/u` tem 2 segmentos no Unix: recusado como amplo antes de qualquer outra regra.
    for target in ["/home", "/home/u"] {
        assert_eq!(
            guard.check(target),
            Err(SafetyViolation::TooBroad {
                target: target.into()
            })
        );
    }
    assert_eq!(
        guard.check("/home/u/.local"),
        Err(SafetyViolation::Protected {
            path: "/home/u/.local".into()
        })
    );
    assert_eq!(guard.check("/home/u/.cache/pip"), Ok(()));
}

#[test]
fn item_status_exposes_codes_and_pending() {
    let cases = [
        (ItemStatus::Done, "ok", false),
        (
            ItemStatus::Partial {
                remaining: disk_cleanup_domain::ByteSize::from_bytes(1),
                detail: None,
            },
            "partial",
            true,
        ),
        (
            ItemStatus::Skipped {
                cause: SkipCause::Missing,
            },
            "skipped",
            false,
        ),
        (
            ItemStatus::Skipped {
                cause: SkipCause::UninstallUnsupported,
            },
            "skipped",
            false,
        ),
        (
            ItemStatus::Skipped {
                cause: SkipCause::Unsafe(SafetyViolation::TooBroad { target: "/".into() }),
            },
            "skipped",
            false,
        ),
        (
            ItemStatus::Failed {
                cause: FailCause::Io("x".into()),
            },
            "failed",
            true,
        ),
        (
            ItemStatus::Failed {
                cause: FailCause::Exit {
                    code: Some(3),
                    last_line: "e".into(),
                },
            },
            "failed",
            true,
        ),
    ];
    for (status, code, pending) in cases {
        assert_eq!(status.code(), code);
        assert_eq!(status.is_pending(), pending);
    }
}
