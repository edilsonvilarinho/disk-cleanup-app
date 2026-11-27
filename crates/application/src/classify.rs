use std::fmt;

use disk_cleanup_domain::{
    path_components, Action, Availability, ByteSize, Candidate, ExclusionList, LocalizedText, Risk,
    Tier, ToolchainGuard,
};

use crate::{
    expand_template, AppError, Catalog, CatalogRepository, CatalogRule, Environment, FoundArtifact,
    PathInspector, ProjectFinder, ProjectProfile, RuleTarget,
};

/// Por que uma regra do catálogo não virou candidato.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SkipReason {
    NotFound(String),
    Empty,
    UnresolvedVariable(String),
    Excluded(LocalizedText),
    Unmeasurable(String),
}

impl fmt::Display for SkipReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SkipReason::NotFound(p) => write!(f, "caminho não existe: {p}"),
            SkipReason::Empty => write!(f, "vazio"),
            SkipReason::UnresolvedVariable(v) => write!(f, "variável de ambiente ausente: {v}"),
            SkipReason::Excluded(r) => write!(f, "excluído: {}", r.pt),
            SkipReason::Unmeasurable(e) => write!(f, "não foi possível medir: {e}"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkippedRule {
    pub id: String,
    pub reason: SkipReason,
}

/// Dados de um candidato que veio de um projeto (não do catálogo de regras).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectInfo {
    /// `id` do candidato.
    pub id: String,
    /// Raiz do projeto.
    pub project: String,
    pub idle_days: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClassificationReport {
    /// Na ordem do catálogo; os artefatos de projeto vêm depois das regras.
    pub candidates: Vec<Candidate>,
    pub skipped: Vec<SkippedRule>,
    pub exclusions: ExclusionList,
    pub projects: Vec<ProjectInfo>,
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
    projects: Option<(&'a dyn ProjectFinder, Vec<String>)>,
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
            projects: None,
        }
    }

    /// Liga a busca de artefatos de projeto. `extra_roots`: pastas de projetos
    /// das Configurações, somadas às do catálogo.
    pub fn with_projects(mut self, finder: &'a dyn ProjectFinder, extra_roots: &[String]) -> Self {
        self.projects = Some((finder, extra_roots.to_vec()));
        self
    }

    /// `baseline`: exclusões obrigatórias da plataforma (definidas na composição).
    /// `extra`: pastas que o usuário protegeu nas Configurações — só somam.
    pub fn run(
        &self,
        baseline: ExclusionList,
        extra: &[String],
    ) -> Result<ClassificationReport, AppError> {
        let catalog = self.catalog.load()?;
        let settings = LocalizedText::new("excluída nas Configurações", "excluded in Settings");
        let baseline = extra
            .iter()
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .fold(baseline, |list, p| list.with(p, settings.clone()));
        let exclusions = catalog.exclusions.iter().fold(baseline, |list, ex| {
            let pattern =
                expand_template(&ex.pattern, self.env).unwrap_or_else(|_| ex.pattern.clone());
            list.with(&pattern, ex.reason.clone())
        });
        let guard = ToolchainGuard::new(self.env.vars(), self.env.path_entries());

        let mut report = ClassificationReport {
            candidates: Vec::new(),
            skipped: Vec::new(),
            exclusions,
            projects: Vec::new(),
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
        for found in self.find_projects(&catalog) {
            let id = format!("project:{}", found.path);
            let Some(profile) = catalog.projects.iter().find(|p| p.id == found.profile) else {
                continue;
            };
            match self.evaluate_artifact(&id, &found, profile, &report.exclusions, &guard) {
                Ok(candidate) => {
                    report.projects.push(ProjectInfo {
                        id,
                        project: found.project,
                        idle_days: found.idle_days,
                    });
                    report.candidates.push(candidate);
                }
                // Artefato vazio não é notícia: some sem poluir "sem candidato".
                Err(SkipReason::Empty) => {}
                Err(reason) => report.skipped.push(SkippedRule { id, reason }),
            }
        }
        Ok(report)
    }

    fn find_projects(&self, catalog: &Catalog) -> Vec<FoundArtifact> {
        let Some((finder, extra)) = &self.projects else {
            return Vec::new();
        };
        if catalog.projects.is_empty() {
            return Vec::new();
        }
        let mut roots: Vec<String> = catalog
            .project_roots
            .iter()
            .filter_map(|r| expand_template(r, self.env).ok())
            .chain(extra.iter().map(|r| r.trim().to_string()))
            .filter(|r| !r.is_empty())
            .collect();
        roots.dedup();
        finder.find(&roots, &catalog.projects)
    }

    fn evaluate_artifact(
        &self,
        id: &str,
        found: &FoundArtifact,
        profile: &ProjectProfile,
        exclusions: &ExclusionList,
        guard: &ToolchainGuard,
    ) -> Result<Candidate, SkipReason> {
        if let Some(ex) = exclusions.matching(&found.path) {
            return Err(SkipReason::Excluded(ex.reason.clone()));
        }
        let size = self
            .inspector
            .size_of(&found.path)
            .map_err(|e| SkipReason::Unmeasurable(e.to_string()))?;
        if size == ByteSize::ZERO {
            return Err(SkipReason::Empty);
        }
        let last = |p: &str| path_components(p).pop().unwrap_or_default();
        let availability = match guard.blocking_reason(&found.path, &[]) {
            Some(reason) => Availability::Blocked { reason },
            None => Availability::Selectable,
        };
        Ok(Candidate {
            id: id.to_string(),
            label: LocalizedText::same(&format!(
                "{} · {}",
                last(&found.project),
                last(&found.path)
            )),
            tier: Tier::C,
            action: Action::RemovePath {
                path: found.path.clone(),
            },
            size,
            risk: Risk::Redownload,
            note: profile.note.clone(),
            availability,
        })
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
