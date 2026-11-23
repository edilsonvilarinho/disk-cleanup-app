//! Lógica dos comandos, independente do Tauri: recebe as portas por parâmetro
//! e devolve DTOs. Os `#[tauri::command]` em `bootstrap.rs` só fazem a ligação.

use std::collections::BTreeSet;
use std::sync::{Mutex, MutexGuard};
use std::time::Instant;

use disk_cleanup_application::{
    export_plan, ActionRunner, CatalogRepository, ClassificationReport, ClassifyService,
    Environment, ExecuteService, ExecutionProgress, FileWalker, PathInspector, PlanCodec,
    ScanProgress, SurveyRequest, SurveyService, VolumeInfo,
};
use disk_cleanup_domain::{
    approve, ApprovedPlan, ByteSize, CleanupReport, ExclusionList, ItemResult, Plan, SafetyGuard,
    Tier, TierRun, VolumeUsage,
};

use crate::dto::{
    ApprovalDto, ClassificationDto, ExecutionEventDto, ItemResultDto, PlanDto, ReportDto, StepDto,
    SurveyDto, SurveyRequestDto, SystemInfoDto, TierRunDto,
};

const NOT_APPROVED: &str = "nenhum plano aprovado: aprove o plano antes de executar";

#[derive(Debug, Default)]
struct SessionState {
    classification: Option<ClassificationReport>,
    plan: Option<Plan>,
    approved: Option<ApprovedPlan>,
    /// Volume antes do primeiro tier executado.
    initial: Option<VolumeUsage>,
    runs: Vec<TierRun>,
}

/// Estado da sessão: classificação, plano, aprovação e execuções.
/// Remontar o plano descarta aprovação e execuções.
#[derive(Debug, Default)]
pub struct Session {
    state: Mutex<SessionState>,
}

impl Session {
    fn lock(&self) -> MutexGuard<'_, SessionState> {
        self.state.lock().unwrap_or_else(|p| p.into_inner())
    }
}

/// Adapta um callback para a porta de progresso da execução.
pub struct CallbackExecution<F: Fn(ExecutionEventDto)> {
    callback: F,
}

impl<F: Fn(ExecutionEventDto)> CallbackExecution<F> {
    pub fn new(callback: F) -> Self {
        Self { callback }
    }
}

impl<F: Fn(ExecutionEventDto)> std::fmt::Debug for CallbackExecution<F> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("CallbackExecution")
    }
}

impl<F: Fn(ExecutionEventDto)> ExecutionProgress for CallbackExecution<F> {
    fn item_started(&self, id: &str) {
        (self.callback)(ExecutionEventDto {
            kind: "started",
            id: id.to_string(),
            result: None,
        });
    }

    fn item_finished(&self, result: &ItemResult) {
        (self.callback)(ExecutionEventDto {
            kind: "finished",
            id: result.id.clone(),
            result: Some(ItemResultDto::from(result)),
        });
    }
}

fn parse_tier(value: &str) -> Result<Tier, String> {
    value.parse::<Tier>().map_err(|e| e.to_string())
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
    session.lock().classification = Some(report);
    Ok(dto)
}

pub fn build_plan(
    session: &Session,
    volume: &str,
    selected: &[String],
    codec: &dyn PlanCodec,
) -> Result<PlanDto, String> {
    let mut state = session.lock();
    let report = state
        .classification
        .as_ref()
        .ok_or("execute a classificação antes de montar o plano")?;
    let ids: Vec<&str> = selected.iter().map(String::as_str).collect();
    let plan = Plan::from_selection(volume, &report.candidates, &ids, &report.exclusions)
        .map_err(|e| e.to_string())?;
    let json = export_plan(&plan, codec).map_err(|e| e.to_string())?;
    let dto = PlanDto::new(&plan, json);
    state.plan = Some(plan);
    state.approved = None;
    state.initial = None;
    state.runs.clear();
    Ok(dto)
}

/// Aprovação explícita dos tiers. O catálogo ainda não declara decisões.
pub fn approve_plan(
    session: &Session,
    tiers: &[String],
    acknowledged: bool,
) -> Result<ApprovalDto, String> {
    let mut state = session.lock();
    let plan = state
        .plan
        .as_ref()
        .ok_or("monte o plano antes de aprovar")?;
    let tiers: BTreeSet<Tier> = tiers
        .iter()
        .map(|t| parse_tier(t))
        .collect::<Result<_, _>>()?;
    let approved = approve(plan, &[], &tiers, acknowledged).map_err(|e| e.to_string())?;
    let dto = ApprovalDto::from(&approved);
    state.approved = Some(approved);
    state.initial = None;
    state.runs.clear();
    Ok(dto)
}

pub fn preview_tier(
    session: &Session,
    runner: &dyn ActionRunner,
    volumes: &dyn VolumeInfo,
    guard: &SafetyGuard,
    tier: &str,
) -> Result<Vec<StepDto>, String> {
    let tier = parse_tier(tier)?;
    let state = session.lock();
    let approved = state.approved.as_ref().ok_or(NOT_APPROVED)?;
    let silent = CallbackExecution::new(|_| {});
    let steps = ExecuteService::new(runner, volumes, guard, &silent)
        .preview(approved, tier)
        .map_err(|e| e.to_string())?;
    Ok(steps.iter().map(StepDto::from).collect())
}

/// Executa um tier aprovado, uma única vez por aprovação.
pub fn execute_tier(
    session: &Session,
    runner: &dyn ActionRunner,
    volumes: &dyn VolumeInfo,
    guard: &SafetyGuard,
    progress: &dyn ExecutionProgress,
    tier: &str,
) -> Result<TierRunDto, String> {
    let tier = parse_tier(tier)?;
    let mut state = session.lock();
    let approved = state.approved.as_ref().ok_or(NOT_APPROVED)?;
    if state.runs.iter().any(|r| r.tier == tier) {
        return Err(format!("tier {tier} já executado nesta aprovação"));
    }
    let initial = match state.initial {
        Some(usage) => usage,
        None => volumes
            .usage(approved.plan().volume())
            .map_err(|e| e.to_string())?,
    };
    let run = ExecuteService::new(runner, volumes, guard, progress)
        .execute(approved, tier)
        .map_err(|e| e.to_string())?;
    let dto = TierRunDto::from(&run);
    state.initial = Some(initial);
    state.runs.push(run);
    Ok(dto)
}

pub fn report(session: &Session, volumes: &dyn VolumeInfo) -> Result<ReportDto, String> {
    let state = session.lock();
    let (Some(initial), Some(approved)) = (state.initial, state.approved.as_ref()) else {
        return Err("nenhuma execução nesta sessão".into());
    };
    let last = volumes
        .usage(approved.plan().volume())
        .map_err(|e| e.to_string())?;
    let report = CleanupReport::new(initial, state.runs.clone(), last);
    Ok(ReportDto::new(&report, state.classification.as_ref()))
}

/// Pastas que nunca podem ser o alvo de uma remoção.
pub fn safety_guard(env: &dyn Environment) -> SafetyGuard {
    const PROTECTED_VARS: [&str; 10] = [
        "USERPROFILE",
        "HOME",
        "LOCALAPPDATA",
        "APPDATA",
        "ProgramData",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "SystemRoot",
        "TEMP",
        "TMP",
    ];
    SafetyGuard::new(PROTECTED_VARS.iter().filter_map(|v| env.var(v)).collect())
}
