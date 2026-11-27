//! Raiz de composição da CLI: liga os adaptadores reais (fora da cobertura,
//! como o `bootstrap.rs` do desktop). A lógica e os testes ficam em `lib.rs`.

use std::env::consts::OS;
use std::process::ExitCode;

use disk_cleanup_cli::{run, Ports, TextFiles};
use disk_cleanup_infrastructure::{
    catalog_for, exclusions_for, FsActionRunner, FsProjectFinder, JwalkFileWalker,
    RegistryOrphanFinder, SkillPlanJsonCodec, SnapshotEnvironment, SysinfoVolumeInfo,
    WalkerPathInspector,
};

struct Disk;

impl TextFiles for Disk {
    fn read(&self, path: &str) -> Result<String, String> {
        std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))
    }
    fn write(&self, path: &str, text: &str) -> Result<(), String> {
        std::fs::write(path, text).map_err(|e| format!("{path}: {e}"))
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let env = SnapshotEnvironment::from_process();
    let catalog = match catalog_for(OS) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("erro: {e}");
            return ExitCode::from(1);
        }
    };
    let ports = Ports {
        env: &env,
        walker: &JwalkFileWalker,
        volumes: &SysinfoVolumeInfo,
        inspector: &WalkerPathInspector::new(JwalkFileWalker),
        catalog: &catalog,
        baseline: exclusions_for(OS, &env),
        finder: &FsProjectFinder::default(),
        orphans: &RegistryOrphanFinder::default(),
        runner: &FsActionRunner::default(),
        codec: &SkillPlanJsonCodec,
        files: &Disk,
        windows: OS == "windows",
    };
    let code = run(&args, &ports, &mut std::io::stdout());
    ExitCode::from(u8::try_from(code).unwrap_or(1))
}
