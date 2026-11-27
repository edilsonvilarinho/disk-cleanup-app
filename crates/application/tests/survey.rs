mod support;

use disk_cleanup_application::{AppError, PortError, SurveyRequest, SurveyService};
use disk_cleanup_domain::{ByteSize, VolumeUsage};
use support::{FakeVolume, FakeWalker, RecordingProgress};

fn volume(total: u64, free: u64) -> FakeVolume {
    FakeVolume(Ok(VolumeUsage::new(
        ByteSize::from_bytes(total),
        ByteSize::from_bytes(free),
    )
    .unwrap()))
}

fn request(depth: usize) -> SurveyRequest {
    SurveyRequest {
        volume_root: r"C:\".into(),
        profile: Some(r"C:\Users\u".into()),
        depth,
    }
}

fn walker() -> FakeWalker {
    let mut w = FakeWalker::with(&[
        (r"C:\Users\u\AppData\Local\npm-cache\a", 400, 400),
        (r"C:\Users\u\OneDrive - Empresa\doc.pdf", 600, 90),
        (r"C:\Users\u\.gradle\caches\b", 100, 100),
        (r"C:\Windows\System32\x.dll", 300, 300),
        (r"C:\pagefile.sys", 200, 200),
    ]);
    w.unreadable = 3;
    w
}

#[test]
fn survey_aggregates_roots_children_profile_and_cloud_in_one_walk() {
    let progress = RecordingProgress::default();
    let report = SurveyService::new(&walker(), &volume(10_000, 1_000), &progress)
        .run(&request(2))
        .unwrap();

    assert_eq!(report.volume.used(), ByteSize::from_bytes(9_000));
    let roots: Vec<_> = report.roots.iter().map(|e| e.name().to_string()).collect();
    assert_eq!(roots, ["Users", "Windows", "pagefile.sys"]);
    assert_eq!(report.roots[0].logical, ByteSize::from_bytes(1_100));

    assert!(report.children.iter().any(|e| e.key == ["Users", "u"]));
    assert!(report
        .children
        .iter()
        .any(|e| e.key == ["Windows", "System32"]));

    let profile: Vec<_> = report
        .profile
        .iter()
        .map(|e| e.name().to_string())
        .collect();
    assert_eq!(profile, ["OneDrive - Empresa", "AppData", ".gradle"]);

    assert_eq!(report.cloud.len(), 1);
    assert_eq!(report.cloud[0].placeholder(), ByteSize::from_bytes(510));

    assert_eq!(report.files, 5);
    assert_eq!(report.unreadable, 3);
    // usado (9000) − alocado atribuído (90+400+100+300+200 = 1090)
    assert_eq!(report.unattributed, ByteSize::from_bytes(7_910));
    assert_eq!(progress.0.borrow().last(), Some(&5));
}

#[test]
fn survey_with_depth_one_and_no_profile_skips_detail_sections() {
    let progress = RecordingProgress::default();
    let req = SurveyRequest {
        profile: None,
        ..request(1)
    };
    let report = SurveyService::new(&walker(), &volume(10_000, 1_000), &progress)
        .run(&req)
        .unwrap();
    assert!(report.children.is_empty());
    assert!(report.profile.is_empty());
    assert!(report.cloud.is_empty());
    assert_eq!(report.roots.len(), 3);
}

#[test]
fn survey_reports_progress_periodically_while_walking() {
    let files: Vec<(String, u64, u64)> =
        (0..25_000).map(|i| (format!(r"C:\d\f{i}"), 1, 1)).collect();
    let walker = FakeWalker {
        files,
        ..FakeWalker::default()
    };
    let progress = RecordingProgress::default();
    SurveyService::new(&walker, &volume(100_000, 1_000), &progress)
        .run(&request(1))
        .unwrap();
    assert_eq!(*progress.0.borrow(), vec![10_000, 20_000, 25_000]);
}

#[test]
fn survey_rejects_invalid_depth_and_propagates_port_errors() {
    let progress = RecordingProgress::default();
    let err = SurveyService::new(&walker(), &volume(10, 1), &progress)
        .run(&request(3))
        .unwrap_err();
    assert_eq!(err, AppError::InvalidDepth(3));

    let failing_volume = FakeVolume(Err(PortError::NotFound("Z:".into())));
    let err = SurveyService::new(&walker(), &failing_volume, &progress)
        .run(&request(1))
        .unwrap_err();
    assert_eq!(err, AppError::Port(PortError::NotFound("Z:".into())));

    let failing_walker = FakeWalker {
        fail: true,
        ..FakeWalker::default()
    };
    let err = SurveyService::new(&failing_walker, &volume(10, 1), &progress)
        .run(&request(1))
        .unwrap_err();
    assert!(matches!(err, AppError::Port(PortError::Io(_))));
    assert!(err.to_string().contains("sem acesso"));
}

#[test]
fn survey_service_has_debug_representation() {
    let (w, v, p) = (walker(), volume(10, 1), RecordingProgress::default());
    assert_eq!(
        format!("{:?}", SurveyService::new(&w, &v, &p)),
        "SurveyService"
    );
}

#[test]
fn survey_keeps_the_largest_files_inside_the_profile_only() {
    let gib = 1024 * 1024 * 1024;
    let mut w = FakeWalker::with(&[
        (r"C:\Users\u\Downloads\ubuntu.iso", 5 * gib, 5 * gib),
        (r"C:\Users\u\Videos\aula.mp4", 3 * gib, 3 * gib),
        (r"C:\Users\u\OneDrive\filme.mkv", 4 * gib, 0),
        (r"C:\Users\u\pequeno.txt", 10, 10),
        (r"C:\pagefile.sys", 8 * gib, 8 * gib),
    ]);
    w.modified = Some(1_700_000_000);
    let report = SurveyService::new(
        &w,
        &volume(1000 * gib, 100 * gib),
        &RecordingProgress::default(),
    )
    .run(&request(1))
    .unwrap();
    let got: Vec<_> = report
        .largest
        .iter()
        .map(|f| (f.path.as_str(), f.size.bytes() / gib, f.modified))
        .collect();
    // placeholder de nuvem (alocado 0) e arquivo fora do perfil não entram
    assert_eq!(
        got,
        vec![
            (r"C:\Users\u\Downloads\ubuntu.iso", 5, Some(1_700_000_000)),
            (r"C:\Users\u\Videos\aula.mp4", 3, Some(1_700_000_000)),
        ]
    );
    let mut no_profile = request(1);
    no_profile.profile = None;
    let report = SurveyService::new(
        &w,
        &volume(1000 * gib, 100 * gib),
        &RecordingProgress::default(),
    )
    .run(&no_profile)
    .unwrap();
    assert!(report.largest.is_empty());
}

#[test]
fn survey_builds_the_volume_map_by_allocated_space() {
    let report = SurveyService::new(
        &walker(),
        &volume(10_000, 1_000),
        &RecordingProgress::default(),
    )
    .run(&request(2))
    .unwrap();
    let attributed: u64 = report.roots.iter().map(|e| e.allocated.bytes()).sum();
    assert_eq!(report.tree.size.bytes(), attributed);
    assert!(!report.tree.children.is_empty());
    assert!(report
        .tree
        .children
        .windows(2)
        .all(|w| w[0].size >= w[1].size || w[1].name.is_empty()));
}
