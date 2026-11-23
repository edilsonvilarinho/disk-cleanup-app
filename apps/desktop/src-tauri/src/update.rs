//! Canal de atualização: decide de qual `latest.json` o updater lê.
//!
//! Estável: `/releases/latest/download/latest.json` — a API do GitHub nunca
//! responde `latest` com prerelease. Beta: a maior versão SemVer (beta ou
//! estável) entre as releases publicadas que têm `latest.json`. A rede fica na
//! raiz de composição; aqui só a regra, testável.

use semver::Version;
use serde::{Deserialize, Serialize};

use crate::error::ErrorDto;

pub const UPDATE_REPOSITORY: &str = "edilsonvilarinho/disk-cleanup-app";
const MANIFEST: &str = "latest.json";

pub fn stable_manifest_url() -> String {
    format!("https://github.com/{UPDATE_REPOSITORY}/releases/latest/download/{MANIFEST}")
}

pub fn releases_api_url() -> String {
    format!("https://api.github.com/repos/{UPDATE_REPOSITORY}/releases?per_page=30")
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    draft: bool,
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

/// `None` quando nenhuma release publicada tem manifesto.
pub fn beta_manifest_url(releases_json: &str) -> Result<Option<String>, ErrorDto> {
    let releases: Vec<Release> = serde_json::from_str(releases_json)
        .map_err(|e| ErrorDto::new("update_feed").with("detail", e))?;
    let best = releases
        .into_iter()
        .filter(|r| !r.draft)
        .filter_map(|r| {
            let version = Version::parse(r.tag_name.strip_prefix('v')?).ok()?;
            let url = r
                .assets
                .into_iter()
                .find(|a| a.name == MANIFEST)?
                .browser_download_url;
            Some((version, url))
        })
        .max_by(|a, b| a.0.cmp(&b.0));
    Ok(best.map(|(_, url)| url))
}

/// `fetch` recebe a URL da API e devolve o corpo; só é chamado no canal beta.
pub fn manifest_url(
    beta: bool,
    fetch: impl FnOnce(&str) -> Result<String, ErrorDto>,
) -> Result<String, ErrorDto> {
    if !beta {
        return Ok(stable_manifest_url());
    }
    let body = fetch(&releases_api_url())?;
    Ok(beta_manifest_url(&body)?.unwrap_or_else(stable_manifest_url))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfoDto {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgressDto {
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percent: Option<u8>,
}

/// Soma os pedaços que o updater entrega e devolve o progresso em texto-pronto.
#[derive(Debug, Default)]
pub struct DownloadProgress {
    downloaded: u64,
}

impl DownloadProgress {
    pub fn add(&mut self, chunk: usize, total: Option<u64>) -> UpdateProgressDto {
        self.downloaded += chunk as u64;
        let percent = total
            .filter(|t| *t > 0)
            .map(|t| (self.downloaded.min(t) * 100 / t) as u8);
        UpdateProgressDto {
            downloaded: self.downloaded,
            total,
            percent,
        }
    }
}
