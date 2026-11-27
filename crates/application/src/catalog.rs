//! Catálogo: dados (não código) que descrevem onde procurar candidatos.
//! Caminhos aceitam `%VAR%`, `${VAR}` e `~`.

use disk_cleanup_domain::{LocalizedText, Risk, Tier};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuleTarget {
    /// Remover o caminho.
    Path { path: String },
    /// Executar um comando; o espaço é medido em `measure`.
    Command { command: String, measure: String },
}

impl RuleTarget {
    /// Caminho (ainda como template) cujo tamanho é o ganho estimado.
    pub fn measured_template(&self) -> &str {
        match self {
            RuleTarget::Path { path } => path,
            RuleTarget::Command { measure, .. } => measure,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatalogRule {
    pub id: String,
    pub label: LocalizedText,
    pub tier: Tier,
    pub risk: Risk,
    pub note: LocalizedText,
    pub target: RuleTarget,
    /// Variáveis de ambiente que, apontando para o alvo, o bloqueiam.
    pub watch_env: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatalogExclusion {
    pub pattern: String,
    pub reason: LocalizedText,
}

/// Perfil de projeto: arquivos que marcam a raiz de um projeto e os diretórios
/// regeneráveis dele (`node_modules`, `target`...). Vira candidato do tier C.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectProfile {
    pub id: String,
    pub label: LocalizedText,
    pub markers: Vec<String>,
    pub artifacts: Vec<String>,
    pub note: LocalizedText,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Catalog {
    pub rules: Vec<CatalogRule>,
    pub exclusions: Vec<CatalogExclusion>,
    pub projects: Vec<ProjectProfile>,
    /// Pastas onde procurar projetos (templates; as inexistentes são ignoradas).
    pub project_roots: Vec<String>,
}
