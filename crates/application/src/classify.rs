use std::fmt;

use disk_cleanup_domain::{
    Action, Availability, ByteSize, Candidate, ExclusionList, ToolchainGuard,
};

use crate::{
    expand_template, AppError, CatalogRepository, CatalogRule, Environment, PathInspector,
    RuleTarget,
};

/// Por que uma regra do catálogo não virou candidato.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SkipReason {
    NotFound(String),
    Empty,
    UnresolvedVariable(String),
    Excluded(String),
    Unmeasurable(String),
}

impl fmt::Display for SkipReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SkipReason::NotFound(p) => write!(f, "caminho não existe: {p}"),
            SkipReason::Empty => write!(f, "vazio"),
            SkipReason::UnresolvedVariable(v) => write!(f, "variável de ambiente ausente: {v}"),
            SkipReason::Excluded(r) => write!(f, "excluído: {r}"),
            SkipReason::Unmeasurable(e) => write!(f, "não foi possível medir: {e}"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkippedRule {
    pub id: String,
    pub reason: SkipReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClassificationReport {
    /// Na ordem do catálogo.
    pub candidates: Vec<Candidate>,
    pub skipped: Vec<SkippedRule>,
    pub exclusions: ExclusionList,
}

impl ClassificationReport {
    pub fn selectable_total(&self) -> ByteSize {
        self.candidates
            .iter()
            .filter(|c| c.availability.is_selectable())
            .map(|c| c.size)
            .sum()
    }
}

/// Transforma regras do catálogo em candidatos medidos, aplicando exclusões e
/// bloqueios de toolchain. Somente leitura.
pub struct ClassifyService<'a> {
    catalog: &'a dyn CatalogRepository,
    env: &'a dyn Environment,
    inspector: &'a dyn PathInspector,
}

impl<'a> ClassifyService<'a> {
    pub fn new(
        catalog: &'a dyn CatalogRepository,
        env: &'a dyn Environment,
        inspector: &'a dyn PathInspector,
    ) -> Self {
        Self {
            catalog,
            env,
            inspector,
        }
    }

    /// `baseline`: exclusões obrigatórias da plataforma (definidas na composição).
    pub fn run(&self, baseline: ExclusionList) -> Result<ClassificationReport, AppError> {
        let catalog = self.catalog.load()?;
        let exclusions = catalog.exclusions.iter().fold(baseline, |list, ex| {
            let pattern =
                expand_template(&ex.pattern, self.env).unwrap_or_else(|_| ex.pattern.clone());
            list.with(&pattern, &ex.reason)
        });
        let guard = ToolchainGuard::new(self.env.vars(), self.env.path_entries());

        let mut report = ClassificationReport {
            candidates: Vec::new(),
            skipped: Vec::new(),
            exclusions,
        };
        for rule in &catalog.rules {
            match self.evaluate(rule, &report.exclusions, &guard) {
                Ok(candidate) => report.candidates.push(candidate),
                Err(reason) => report.skipped.push(SkippedRule {
                    id: rule.id.clone(),
                    reason,
                }),
            }
        }
        Ok(report)
    }

    fn evaluate(
        &self,
        rule: &CatalogRule,
        exclusions: &ExclusionList,
        guard: &ToolchainGuard,
    ) -> Result<Candidate, SkipReason> {
        let measured = expand_template(rule.target.measured_template(), self.env)
            .map_err(SkipReason::UnresolvedVariable)?;
        if let Some(ex) = exclusions.matching(&measured) {
            return Err(SkipReason::Excluded(ex.reason.clone()));
        }
        if !self.inspector.exists(&measured) {
            return Err(SkipReason::NotFound(measured));
        }
        let size = self
            .inspector
            .size_of(&measured)
            .map_err(|e| SkipReason::Unmeasurable(e.to_string()))?;
        if size == ByteSize::ZERO {
            return Err(SkipReason::Empty);
        }
        let action = match &rule.target {
            RuleTarget::Path { .. } => Action::RemovePath {
                path: measured.clone(),
            },
            RuleTarget::Command { command, .. } => Action::Command {
                command: command.clone(),
            },
        };
        let availability = match guard.blocking_reason(&measured, &rule.watch_env) {
            Some(reason) => Availability::Blocked { reason },
            None => Availability::Selectable,
        };
        Ok(Candidate {
            id: rule.id.clone(),
            label: rule.label.clone(),
            tier: rule.tier,
            action,
            size,
            risk: rule.risk,
            note: rule.note.clone(),
            availability,
        })
    }
}

impl fmt::Debug for ClassifyService<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("ClassifyService")
    }
}
