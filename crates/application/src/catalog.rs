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

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Catalog {
    pub rules: Vec<CatalogRule>,
    pub exclusions: Vec<CatalogExclusion>,
}
