use std::collections::HashSet;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use disk_cleanup_application::{
    Catalog, CatalogExclusion, CatalogRepository, CatalogRule, PortError, RuleTarget,
};
use disk_cleanup_domain::{Risk, Tier};
use serde::Deserialize;

const BUNDLED_WINDOWS: &str = include_str!("../../../catalog/windows.toml");

#[derive(Debug, Clone)]
enum Source {
    Text(String),
    File(PathBuf),
}

/// Catálogo em TOML: adicionar alvo de limpeza não exige recompilar.
#[derive(Debug, Clone)]
pub struct TomlCatalogRepository {
    source: Source,
}

impl TomlCatalogRepository {
    pub fn from_text(text: &str) -> Self {
        Self {
            source: Source::Text(text.to_string()),
        }
    }

    pub fn from_file(path: impl AsRef<Path>) -> Self {
        Self {
            source: Source::File(path.as_ref().to_path_buf()),
        }
    }

    /// Catálogo do Windows embutido no binário (`catalog/windows.toml`).
    pub fn bundled_windows() -> Self {
        Self::from_text(BUNDLED_WINDOWS)
    }

    fn read(&self) -> Result<String, PortError> {
        match &self.source {
            Source::Text(text) => Ok(text.clone()),
            Source::File(path) => std::fs::read_to_string(path).map_err(|e| match e.kind() {
                ErrorKind::NotFound => PortError::NotFound(path.display().to_string()),
                _ => PortError::Io(format!("{}: {e}", path.display())),
            }),
        }
    }
}

#[derive(Debug, Deserialize)]
struct FileModel {
    #[serde(default)]
    exclusion: Vec<ExclusionModel>,
    #[serde(default)]
    rule: Vec<RuleModel>,
}

#[derive(Debug, Deserialize)]
struct ExclusionModel {
    pattern: String,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct RuleModel {
    id: String,
    label: String,
    tier: String,
    risk: String,
    #[serde(default)]
    note: String,
    kind: String,
    path: Option<String>,
    command: Option<String>,
    measure: Option<String>,
    #[serde(default)]
    watch_env: Vec<String>,
}

fn parse_risk(value: &str) -> Option<Risk> {
    match value {
        "none" => Some(Risk::None),
        "low" => Some(Risk::Low),
        "redownload" => Some(Risk::Redownload),
        "long-running" => Some(Risk::LongRunning),
        _ => None,
    }
}

impl RuleModel {
    fn into_rule(self) -> Result<CatalogRule, String> {
        let tier: Tier = self.tier.parse().map_err(|e| format!("{e}"))?;
        let risk =
            parse_risk(&self.risk).ok_or_else(|| format!("risco desconhecido '{}'", self.risk))?;
        let target = match (self.kind.as_str(), self.path, self.command, self.measure) {
            ("path", Some(path), _, _) => RuleTarget::Path { path },
            ("path", None, _, _) => return Err("kind=path exige 'path'".into()),
            ("command", _, Some(command), Some(measure)) => {
                RuleTarget::Command { command, measure }
            }
            ("command", ..) => return Err("kind=command exige 'command' e 'measure'".into()),
            (other, ..) => return Err(format!("kind '{other}' ainda não suportado pelo catálogo")),
        };
        Ok(CatalogRule {
            id: self.id,
            label: self.label,
            tier,
            risk,
            note: self.note,
            target,
            watch_env: self.watch_env,
        })
    }
}

impl CatalogRepository for TomlCatalogRepository {
    fn load(&self) -> Result<Catalog, PortError> {
        let model: FileModel = toml::from_str(&self.read()?)
            .map_err(|e| PortError::InvalidData(format!("TOML inválido: {e}")))?;
        let mut ids = HashSet::new();
        let mut rules = Vec::with_capacity(model.rule.len());
        for rule in model.rule {
            let id = rule.id.clone();
            if !ids.insert(id.clone()) {
                return Err(PortError::InvalidData(format!("id duplicado: {id}")));
            }
            rules.push(
                rule.into_rule()
                    .map_err(|e| PortError::InvalidData(format!("regra '{id}': {e}")))?,
            );
        }
        let exclusions = model
            .exclusion
            .into_iter()
            .map(|e| CatalogExclusion {
                pattern: e.pattern,
                reason: e.reason,
            })
            .collect();
        Ok(Catalog { rules, exclusions })
    }
}
