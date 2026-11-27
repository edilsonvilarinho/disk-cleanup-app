//! Raiz de composição: instancia os adaptadores concretos e registra os
//! comandos. Sem regra de negócio — tudo delega para `service`.
//! Excluído da medição de cobertura (exige runtime Tauri/WebView).

use std::collections::BTreeMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter, Manager, State, Url, Webview};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_updater::{Update, UpdaterExt};

use disk_cleanup_application::Environment;
use disk_cleanup_infrastructure::{
    catalog_for, exclusions_for, FsActionRunner, FsProjectFinder, JwalkFileWalker,
    RegistryOrphanFinder, SkillPlanJsonCodec, SnapshotEnvironment, StdContentHasher,
    SysinfoVolumeInfo, TomlCatalogRepository, WalkerPathInspector,
};

use crate::dto::{
    ApprovalDto, ClassificationDto, DuplicatesDto, PlanDto, ReportDto, RuleCheckDto, StepDto,
    SurveyDto, SurveyRequestDto, SystemInfoDto, TierRunDto, UserCustomizationDto,
};
use crate::error::ErrorDto;
use crate::export;
use crate::service::{self, CallbackExecution, CallbackProgress, Session};
use crate::update::{manifest_url, releases_api_url, DownloadProgress, UpdateInfoDto};

const PROGRESS_EVENT: &str = "survey-progress";
const EXECUTION_EVENT: &str = "execution-progress";
const UPDATE_EVENT: &str = "update-progress";
const OS: &str = std::env::consts::OS;
/// Nome sugerido do PNG, no cabeçalho do invoke (o corpo leva só os bytes).
const FILE_NAME_HEADER: &str = "x-file-name";

/// Atualização encontrada por `check_update` e, depois, os bytes baixados.
#[derive(Default)]
struct UpdateSlot {
    update: Option<Update>,
    bytes: Option<Vec<u8>>,
}

#[derive(Default)]
struct PendingUpdate(Mutex<UpdateSlot>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    files: u64,
    logical_bytes: u64,
}

fn join_error(e: tauri::Error) -> ErrorDto {
    ErrorDto::new("internal").with("detail", e)
}

#[tauri::command]
fn system_info() -> SystemInfoDto {
    let env = SnapshotEnvironment::from_process();
    match catalog_for(OS) {
        Ok(catalog) => service::system_info(&env, OS, &catalog),
        Err(_) => service::system_info(&env, OS, &TomlCatalogRepository::from_text("")),
    }
}

#[tauri::command]
async fn run_survey(app: AppHandle, request: SurveyRequestDto) -> Result<SurveyDto, ErrorDto> {
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
        let session = app.state::<Session>();
        service::run_survey_in(
            &session,
            &JwalkFileWalker,
            &SysinfoVolumeInfo,
            &progress,
            &request,
        )
    })
    .await
    .map_err(join_error)?
}

/// Duplicados no perfil do usuário (fora dele, só sistema e programas).
#[tauri::command]
async fn find_duplicates(app: AppHandle) -> Result<DuplicatesDto, ErrorDto> {
    tauri::async_runtime::spawn_blocking(move || {
        let env = SnapshotEnvironment::from_process();
        let profile = env.var(if OS == "windows" {
            "USERPROFILE"
        } else {
            "HOME"
        });
        let roots: Vec<String> = profile.into_iter().collect();
        let session = app.state::<Session>();
        service::find_duplicates(&session, &JwalkFileWalker, &StdContentHasher, &roots)
    })
    .await
    .map_err(join_error)?
}

#[tauri::command]
fn check_rule(extra_exclusions: Vec<String>, path: String) -> Result<RuleCheckDto, ErrorDto> {
    let env = SnapshotEnvironment::from_process();
    service::check_rule(
        &catalog_for(OS)?,
        &env,
        exclusions_for(OS, &env),
        &extra_exclusions,
        &path,
    )
}

#[tauri::command]
async fn classify(
    app: AppHandle,
    extra_exclusions: Vec<String>,
    project_roots: Vec<String>,
    customization: UserCustomizationDto,
) -> Result<ClassificationDto, ErrorDto> {
    tauri::async_runtime::spawn_blocking(move || {
        let env = SnapshotEnvironment::from_process();
        let session = app.state::<Session>();
        let finder = FsProjectFinder::default();
        service::classify_custom(
            &session,
            &catalog_for(OS)?,
            &env,
            &WalkerPathInspector::new(JwalkFileWalker),
            exclusions_for(OS, &env),
            &extra_exclusions,
            Some(service::ProjectSearch {
                finder: &finder,
                roots: &project_roots,
            }),
            Some(&RegistryOrphanFinder::default()),
            &customization,
        )
    })
    .await
    .map_err(join_error)?
}

#[tauri::command]
fn build_plan(
    session: State<'_, Session>,
    volume: String,
    selected: Vec<String>,
) -> Result<PlanDto, ErrorDto> {
    service::build_plan(&session, &volume, &selected, &SkillPlanJsonCodec)
}

#[tauri::command]
fn approve_plan(
    session: State<'_, Session>,
    tiers: Vec<String>,
    disposals: BTreeMap<String, String>,
    acknowledged: bool,
) -> Result<ApprovalDto, ErrorDto> {
    service::approve_plan(&session, &tiers, &disposals, acknowledged)
}

#[tauri::command]
fn preview_tier(session: State<'_, Session>, tier: String) -> Result<Vec<StepDto>, ErrorDto> {
    let guard = service::safety_guard(&SnapshotEnvironment::from_process());
    service::preview_tier(
        &session,
        &FsActionRunner::default(),
        &SysinfoVolumeInfo,
        &guard,
        &tier,
    )
}

#[tauri::command]
async fn execute_tier(app: AppHandle, tier: String) -> Result<TierRunDto, ErrorDto> {
    tauri::async_runtime::spawn_blocking(move || {
        let guard = service::safety_guard(&SnapshotEnvironment::from_process());
        let progress = CallbackExecution::new(|event| {
            let _ = app.emit(EXECUTION_EVENT, event);
        });
        let session = app.state::<Session>();
        service::execute_tier(
            &session,
            &FsActionRunner::default(),
            &SysinfoVolumeInfo,
            &guard,
            &progress,
            &tier,
        )
    })
    .await
    .map_err(join_error)?
}

#[tauri::command]
fn report(session: State<'_, Session>) -> Result<ReportDto, ErrorDto> {
    service::report(&session, &SysinfoVolumeInfo)
}

/// Diálogo de impressão nativo (Windows: `window.print`; Linux: GTK; macOS:
/// `NSPrintOperation`). "Salvar como PDF" é uma das saídas do próprio diálogo.
#[tauri::command]
fn print_page(webview: Webview) -> Result<(), ErrorDto> {
    webview
        .print()
        .map_err(|e| ErrorDto::new("export_print").with("detail", e))
}

/// Grava o PNG onde o usuário escolher no "Salvar como". `Ok(None)` = cancelou.
/// A WebView não informa caminho: só bytes (validados como PNG) e nome sugerido.
#[tauri::command]
async fn save_png(app: AppHandle, request: Request<'_>) -> Result<Option<String>, ErrorDto> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(ErrorDto::new("export_not_png"));
    };
    export::validate_png(bytes)?;
    let name = export::suggested_png_name(
        request
            .headers()
            .get(FILE_NAME_HEADER)
            .and_then(|v| v.to_str().ok()),
    );
    let bytes = bytes.clone();
    let write_error = |e: &dyn std::fmt::Display| ErrorDto::new("export_write").with("detail", e);
    tauri::async_runtime::spawn_blocking(move || {
        let Some(chosen) = app
            .dialog()
            .file()
            .set_file_name(&name)
            .add_filter("PNG", &["png"])
            .blocking_save_file()
        else {
            return Ok(None);
        };
        let path = export::with_png_extension(&chosen.into_path().map_err(|e| write_error(&e))?);
        std::fs::write(&path, &bytes).map_err(|e| write_error(&e))?;
        Ok(Some(path.display().to_string()))
    })
    .await
    .map_err(join_error)?
}

fn update_error(e: impl ToString) -> ErrorDto {
    ErrorDto::new("update").with("detail", e.to_string())
}

fn slot(state: &PendingUpdate) -> std::sync::MutexGuard<'_, UpdateSlot> {
    state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

async fn fetch_releases(url: &str) -> Result<String, ErrorDto> {
    let feed = |e: reqwest::Error| ErrorDto::new("update_feed").with("detail", e);
    reqwest::Client::builder()
        .user_agent(concat!("disk-cleanup/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(feed)?
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(feed)?
        .text()
        .await
        .map_err(feed)
}

#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
async fn check_update(
    app: AppHandle,
    state: State<'_, PendingUpdate>,
    beta: bool,
) -> Result<Option<UpdateInfoDto>, ErrorDto> {
    let feed = if beta {
        Some(fetch_releases(&releases_api_url()).await)
    } else {
        None
    };
    let url = manifest_url(beta, |_| feed.unwrap_or_else(|| Ok("[]".into())))?;
    let endpoint = Url::parse(&url).map_err(update_error)?;
    let found = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(update_error)?
        .build()
        .map_err(update_error)?
        .check()
        .await
        .map_err(update_error)?;
    let info = found.as_ref().map(|u| UpdateInfoDto {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        notes: u.body.clone(),
        date: u.date.map(|d| d.to_string()),
    });
    *slot(&state) = UpdateSlot {
        update: found,
        bytes: None,
    };
    Ok(info)
}

#[tauri::command]
async fn download_update(app: AppHandle, state: State<'_, PendingUpdate>) -> Result<(), ErrorDto> {
    let update = slot(&state)
        .update
        .clone()
        .ok_or_else(|| ErrorDto::new("update_none"))?;
    let mut progress = DownloadProgress::default();
    let bytes = update
        .download(
            |chunk, total| {
                let _ = app.emit(UPDATE_EVENT, progress.add(chunk, total));
            },
            || {},
        )
        .await
        .map_err(update_error)?;
    slot(&state).bytes = Some(bytes);
    Ok(())
}

/// No Windows o instalador NSIS (modo passivo) encerra o app sozinho; nos
/// demais o processo é reiniciado já na versão nova.
#[tauri::command]
fn install_update(app: AppHandle, state: State<'_, PendingUpdate>) -> Result<(), ErrorDto> {
    let (update, bytes) = {
        let mut guard = slot(&state);
        match (guard.update.clone(), guard.bytes.take()) {
            (Some(u), Some(b)) => (u, b),
            _ => return Err(ErrorDto::new("update_not_downloaded")),
        }
    };
    update.install(bytes).map_err(update_error)?;
    app.restart()
}

pub fn run(context: tauri::Context<tauri::Wry>) {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(Session::default())
        .manage(PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![
            system_info,
            run_survey,
            classify,
            check_rule,
            find_duplicates,
            build_plan,
            approve_plan,
            preview_tier,
            execute_tier,
            report,
            print_page,
            save_png,
            app_version,
            check_update,
            download_update,
            install_update
        ])
        .run(context)
        .expect("falha ao iniciar o Disk Cleanup");
}
