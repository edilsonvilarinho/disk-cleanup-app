use disk_cleanup_desktop_lib::{
    beta_manifest_url, manifest_url, releases_api_url, stable_manifest_url, DownloadProgress,
    ErrorDto, UpdateInfoDto,
};

const STABLE: &str =
    "https://github.com/edilsonvilarinho/disk-cleanup-app/releases/latest/download/latest.json";

fn release(tag: &str, draft: bool, with_manifest: bool) -> String {
    let assets = if with_manifest {
        format!(
            r#"[{{"name":"disk-cleanup.exe","browser_download_url":"https://x/{tag}/setup.exe"}},
               {{"name":"latest.json","browser_download_url":"https://x/{tag}/latest.json"}}]"#
        )
    } else {
        "[]".to_string()
    };
    format!(r#"{{"tag_name":"{tag}","draft":{draft},"prerelease":true,"assets":{assets}}}"#)
}

fn list(items: &[String]) -> String {
    format!("[{}]", items.join(","))
}

#[test]
fn urls_apontam_para_o_repositorio_publico() {
    assert_eq!(stable_manifest_url(), STABLE);
    assert_eq!(
        releases_api_url(),
        "https://api.github.com/repos/edilsonvilarinho/disk-cleanup-app/releases?per_page=30"
    );
}

#[test]
fn beta_escolhe_a_maior_versao_semver_entre_beta_e_estavel() {
    let json = list(&[
        release("v0.1.0", false, true),
        release("v0.2.0-beta.2", false, true),
        release("v0.2.0-beta.10", false, true),
        release("v0.1.1", false, true),
    ]);
    assert_eq!(
        beta_manifest_url(&json).unwrap().as_deref(),
        Some("https://x/v0.2.0-beta.10/latest.json")
    );

    // A estável de mesmo número vence a série beta.
    let json = list(&[
        release("v0.2.0-beta.3", false, true),
        release("v0.2.0", false, true),
    ]);
    assert_eq!(
        beta_manifest_url(&json).unwrap().as_deref(),
        Some("https://x/v0.2.0/latest.json")
    );
}

#[test]
fn beta_ignora_rascunho_tag_invalida_e_release_sem_manifesto() {
    let json = list(&[
        release("v9.0.0", true, true),
        release("nightly", false, true),
        release("v8.0.0", false, false),
        release("v0.3.0-beta.1", false, true),
    ]);
    assert_eq!(
        beta_manifest_url(&json).unwrap().as_deref(),
        Some("https://x/v0.3.0-beta.1/latest.json")
    );
    assert_eq!(beta_manifest_url("[]").unwrap(), None);
}

#[test]
fn beta_recusa_resposta_que_nao_e_lista_de_releases() {
    let err = beta_manifest_url(r#"{"message":"API rate limit exceeded"}"#).unwrap_err();
    assert_eq!(err.code, "update_feed");
    assert!(err.params["detail"].contains("invalid type"));
}

#[test]
fn canal_estavel_nao_consulta_a_api() {
    let url = manifest_url(false, |_| panic!("não deveria consultar a API")).unwrap();
    assert_eq!(url, STABLE);
}

#[test]
fn canal_beta_consulta_a_api_e_cai_para_estavel_sem_candidato() {
    let mut asked = String::new();
    let url = manifest_url(true, |api| {
        asked = api.to_string();
        Ok(list(&[release("v0.2.0-beta.1", false, true)]))
    })
    .unwrap();
    assert_eq!(url, "https://x/v0.2.0-beta.1/latest.json");
    assert_eq!(asked, releases_api_url());

    assert_eq!(manifest_url(true, |_| Ok("[]".into())).unwrap(), STABLE);

    let err = manifest_url(true, |_| {
        Err(ErrorDto::new("update_feed").with("detail", "offline"))
    })
    .unwrap_err();
    assert_eq!(err.params["detail"], "offline");
}

#[test]
fn progresso_acumula_bytes_e_calcula_percentual() {
    let mut progress = DownloadProgress::default();
    let first = progress.add(250, Some(1000));
    assert_eq!(
        (first.downloaded, first.total, first.percent),
        (250, Some(1000), Some(25))
    );
    let second = progress.add(750, Some(1000));
    assert_eq!(second.percent, Some(100));

    let mut unknown = DownloadProgress::default();
    let p = unknown.add(10, None);
    assert_eq!((p.downloaded, p.total, p.percent), (10, None, None));
    assert_eq!(unknown.add(5, Some(0)).percent, None);
}

#[test]
fn info_da_atualizacao_serializa_em_camel_case() {
    let info = UpdateInfoDto {
        version: "0.2.0".into(),
        current_version: "0.1.0".into(),
        notes: Some("## Changes".into()),
        date: None,
    };
    let json = serde_json::to_value(&info).unwrap();
    assert_eq!(json["currentVersion"], "0.1.0");
    assert_eq!(json["notes"], "## Changes");
    assert!(json["date"].is_null());
}
