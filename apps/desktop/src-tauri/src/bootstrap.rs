//! Raiz de composição: instancia os adaptadores concretos e registra os
//! comandos. Sem regra de negócio — tudo delega para `service`.
//! Excluído da medição de cobertura (exige runtime Tauri/WebView).

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use disk_cleanup_infrastructure::{
    platform_exclusions, FsActionRunner, JwalkFileWalker, SkillPlanJsonCodec, SnapshotEnvironment,
    SysinfoVolumeInfo, TomlCatalogRepository, WalkerPathInspector,
};

use crate::dto::{
    ApprovalDto, ClassificationDto, PlanDto, ReportDto, StepDto, SurveyDto, SurveyRequestDto,
    SystemInfoDto, TierRunDto,
};
use crate::service::{self, CallbackExecution, CallbackProgress, Session};

const PROGRESS_EVENT: &str = "survey-progress";
const EXECUTION_EVENT: &str = "execution-progress";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    files: u64,
    logical_bytes: u64,
}

#[tauri::command]
fn system_info() -> SystemInfoDto {
    service::system_info(&SnapshotEnvironment::from_process(), std::env::consts::OS)
}

#[tauri::command]
async fn run_survey(app: AppHandle, request: SurveyRequestDto) -> Result<SurveyDto, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let progress = CallbackProgress::new(|files, logical_bytes| {
            let _ = app.emit(
                PROGRESS_EVENT,
                ProgressPayload {
                    files,
                    logical_bytes,
                },
            );
        });
        service::run_survey(&JwalkFileWalker, &SysinfoVolumeInfo, &progress, &request)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn classify(app: AppHandle) -> Result<ClassificationDto, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let env = SnapshotEnvironment::from_process();
        let session = app.state::<Session>();
        service::classify(
            &session,
            &TomlCatalogRepository::bundled_windows(),
            &env,
            &WalkerPathInspector::new(JwalkFileWalker),
            platform_exclusions(&env),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn build_plan(
    session: State<'_, Session>,
    volume: String,
    selected: Vec<String>,
) -> Result<PlanDto, String> {
    service::build_plan(&session, &volume, &selected, &SkillPlanJsonCodec)
}

#[tauri::command]
fn approve_plan(
    session: State<'_, Session>,
    tiers: Vec<String>,
    acknowledged: bool,
) -> Result<ApprovalDto, String> {
    service::approve_plan(&session, &tiers, acknowledged)
}

#[tauri::command]
fn preview_tier(session: State<'_, Session>, tier: String) -> Result<Vec<StepDto>, String> {
    let guard = service::safety_guard(&SnapshotEnvironment::from_process());
    service::preview_tier(&session, &FsActionRunner, &SysinfoVolumeInfo, &guard, &tier)
}

#[tauri::command]
async fn execute_tier(app: AppHandle, tier: String) -> Result<TierRunDto, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let guard = service::safety_guard(&SnapshotEnvironment::from_process());
        let progress = CallbackExecution::new(|event| {
            let _ = app.emit(EXECUTION_EVENT, event);
        });
        let session = app.state::<Session>();
        service::execute_tier(
            &session,
            &FsActionRunner,
            &SysinfoVolumeInfo,
            &guard,
            &progress,
            &tier,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn report(session: State<'_, Session>) -> Result<ReportDto, String> {
    service::report(&session, &SysinfoVolumeInfo)
}

pub fn run(context: tauri::Context<tauri::Wry>) {
    tauri::Builder::default()
        .manage(Session::default())
        .invoke_handler(tauri::generate_handler![
            system_info,
            run_survey,
            classify,
            build_plan,
            approve_plan,
            preview_tier,
            execute_tier,
            report
        ])
        .run(context)
        .expect("falha ao iniciar o Disk Cleanup");
}
