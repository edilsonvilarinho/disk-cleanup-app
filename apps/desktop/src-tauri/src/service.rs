//! Lógica dos comandos, independente do Tauri: recebe as portas por parâmetro
//! e devolve DTOs. Os `#[tauri::command]` em `bootstrap.rs` só fazem a ligação.

use std::sync::Mutex;
use std::time::Instant;

use disk_cleanup_application::{
    export_plan, CatalogRepository, ClassificationReport, ClassifyService, Environment, FileWalker,
    PathInspector, PlanCodec, ScanProgress, SurveyRequest, SurveyService, VolumeInfo,
};
use disk_cleanup_domain::{ByteSize, ExclusionList, Plan};

use crate::dto::{ClassificationDto, PlanDto, SurveyDto, SurveyRequestDto, SystemInfoDto};

/// Estado da sessão: a última classificação, base do plano.
#[derive(Debug, Default)]
pub struct Session {
    classification: Mutex<Option<ClassificationReport>>,
}

/// Adapta um callback para a porta de progresso (eventos Tauri, logs...).
pub struct CallbackProgress<F: Fn(u64, u64)> {
    callback: F,
}

impl<F: Fn(u64, u64)> CallbackProgress<F> {
    pub fn new(callback: F) -> Self {
        Self { callback }
    }
}

impl<F: Fn(u64, u64)> std::fmt::Debug for CallbackProgress<F> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("CallbackProgress")
    }
}

impl<F: Fn(u64, u64)> ScanProgress for CallbackProgress<F> {
    fn scanned(&self, files: u64, logical: ByteSize) {
        (self.callback)(files, logical.bytes());
    }
}

/// `os`: valor de `std::env::consts::OS` ("windows", "linux", "macos").
pub fn system_info(env: &dyn Environment, os: &str) -> SystemInfoDto {
    let (volume_root, profile) = if os == "windows" {
        let drive = env.var("SystemDrive").unwrap_or_else(|| "C:".to_string());
        (format!(r"{drive}\"), env.var("USERPROFILE"))
    } else {
        ("/".to_string(), env.var("HOME"))
    };
    SystemInfoDto {
        os: os.to_string(),
        volume_root,
        profile,
        catalog: os.to_string(),
    }
}

pub fn run_survey(
    walker: &dyn FileWalker,
    volumes: &dyn VolumeInfo,
    progress: &dyn ScanProgress,
    request: &SurveyRequestDto,
) -> Result<SurveyDto, String> {
    let started = Instant::now();
    let report = SurveyService::new(walker, volumes, progress)
        .run(&SurveyRequest {
            volume_root: request.volume_root.clone(),
            profile: request.profile.clone(),
            depth: request.depth,
        })
        .map_err(|e| e.to_string())?;
    let elapsed = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
    Ok(SurveyDto::from_report(&report, elapsed))
}

pub fn classify(
    session: &Session,
    catalog: &dyn CatalogRepository,
    env: &dyn Environment,
    inspector: &dyn PathInspector,
    baseline: ExclusionList,
) -> Result<ClassificationDto, String> {
    let report = ClassifyService::new(catalog, env, inspector)
        .run(baseline)
        .map_err(|e| e.to_string())?;
    let dto = ClassificationDto::from(&report);
    *session
        .classification
        .lock()
        .unwrap_or_else(|p| p.into_inner()) = Some(report);
    Ok(dto)
}

pub fn build_plan(
    session: &Session,
    volume: &str,
    selected: &[String],
    codec: &dyn PlanCodec,
) -> Result<PlanDto, String> {
    let guard = session
        .classification
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    let report = guard
        .as_ref()
        .ok_or("execute a classificação antes de montar o plano")?;
    let ids: Vec<&str> = selected.iter().map(String::as_str).collect();
    let plan = Plan::from_selection(volume, &report.candidates, &ids, &report.exclusions)
        .map_err(|e| e.to_string())?;
    let json = export_plan(&plan, codec).map_err(|e| e.to_string())?;
    Ok(PlanDto::new(&plan, json))
}
