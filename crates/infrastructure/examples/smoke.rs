//! Smoke test manual contra o disco real (somente leitura):
//!   cargo run --release -p disk-cleanup-infrastructure --example smoke -- C:\
use std::time::Instant;

use disk_cleanup_application::{ClassifyService, Environment, SurveyRequest, SurveyService};
use disk_cleanup_infrastructure::{
    catalog_for, exclusions_for, JwalkFileWalker, SilentProgress, SnapshotEnvironment,
    SysinfoVolumeInfo, WalkerPathInspector,
};

fn main() {
    let root = std::env::args().nth(1).unwrap_or_else(|| "C:\\".into());
    let env = SnapshotEnvironment::from_process();
    let profile = env.var("USERPROFILE").or_else(|| env.var("HOME"));

    let started = Instant::now();
    let report = SurveyService::new(&JwalkFileWalker, &SysinfoVolumeInfo, &SilentProgress)
        .run(&SurveyRequest {
            volume_root: root.clone(),
            profile,
            depth: 2,
        })
        .expect("survey");
    println!(
        "survey {root}: {:.1}s, {} arquivos, {} sem acesso",
        started.elapsed().as_secs_f64(),
        report.files,
        report.unreadable
    );
    println!(
        "volume: total {:.1} GB, livre {:.1} GB ({:.1}%)",
        report.volume.total().gib(),
        report.volume.free().gib(),
        report.volume.free_percent()
    );
    for e in report.roots.iter().take(8) {
        println!("  raiz  {:<28} {:>8.1} GB", e.name(), e.logical.gib());
    }
    for e in &report.cloud {
        println!(
            "  nuvem {:<28} lógico {:>7.1} GB  real {:>7.1} GB",
            e.name(),
            e.logical.gib(),
            e.allocated.gib()
        );
    }

    let started = Instant::now();
    let classes = ClassifyService::new(
        &catalog_for(std::env::consts::OS).expect("catálogo"),
        &env,
        &WalkerPathInspector::new(JwalkFileWalker),
    )
    .run(exclusions_for(std::env::consts::OS, &env), &[])
    .expect("classify");
    println!(
        "classify: {:.1}s, {} candidatos, {} regras sem candidato, selecionável {:.1} GB",
        started.elapsed().as_secs_f64(),
        classes.candidates.len(),
        classes.skipped.len(),
        classes.selectable_total().gib()
    );
    for c in &classes.candidates {
        println!(
            "  [{}] {:<34} {:>7.2} GB {}",
            c.tier,
            c.label.pt,
            c.size.gib(),
            if c.availability.is_selectable() {
                ""
            } else {
                "BLOQUEADO"
            }
        );
    }
}
