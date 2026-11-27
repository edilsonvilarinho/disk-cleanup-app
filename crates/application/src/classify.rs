use std::fmt;

use disk_cleanup_domain::{
    path_components, Action, Availability, ByteSize, Candidate, ExclusionList, LargeFile,
    LocalizedText, Risk, Tier, ToolchainGuard,
};

use crate::{
    expand_template, AppError, Catalog, CatalogRepository, CatalogRule, DuplicateGroup,
    Environment, FoundArtifact, PathInspector, ProjectFinder, ProjectProfile, RuleTarget,
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

/// Cópia duplicada oferecida como candidato; `keep` é a que fica.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DuplicateInfo {
    /// `id` do candidato.
    pub id: String,
    pub keep: String,
}

/// Dados de um candidato que veio dos arquivos grandes da varredura.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LargeFileInfo {
    /// `id` do candidato.
    pub id: String,
    /// Dias desde a última modificação.
    pub age_days: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClassificationReport {
    /// Na ordem do catálogo; os artefatos de projeto vêm depois das regras.
    pub candidates: Vec<Candidate>,
    pub skipped: Vec<SkippedRule>,
    pub exclusions: ExclusionList,
    pub projects: Vec<ProjectInfo>,
    pub large_files: Vec<LargeFileInfo>,
    pub duplicates: Vec<DuplicateInfo>,
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
    large_files: (&'a [LargeFile], u64),
    user_rules: &'a [CatalogRule],
    disabled_profiles: &'a [String],
    duplicates: &'a [DuplicateGroup],
}

/// Exclusões efetivas: obrigatórias + pastas das Configurações + catálogo.
/// Só somam; nenhuma fonte remove exclusão de outra.
pub fn effective_exclusions(
    catalog: &Catalog,
    env: &dyn Environment,
    baseline: ExclusionList,
    extra: &[String],
) -> ExclusionList {
    let settings = LocalizedText::new("excluída nas Configurações", "excluded in Settings");
    let baseline = extra
        .iter()
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .fold(baseline, |list, p| list.with(p, settings.clone()));
    catalog.exclusions.iter().fold(baseline, |list, ex| {
        let pattern = expand_template(&ex.pattern, env).unwrap_or_else(|_| ex.pattern.clone());
        list.with(&pattern, ex.reason.clone())
    })
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
            large_files: (&[], 0),
            user_rules: &[],
            disabled_profiles: &[],
            duplicates: &[],
        }
    }

    /// Cópias duplicadas (exceto a mantida) como candidatos do tier D.
    pub fn with_duplicates(mut self, groups: &'a [DuplicateGroup]) -> Self {
        self.duplicates = groups;
        self
    }

    /// Regras próprias do usuário (somadas às do catálogo, com as mesmas
    /// exclusões e guardas) e perfis de projeto desligados.
    pub fn with_user_rules(
        mut self,
        rules: &'a [CatalogRule],
        disabled_profiles: &'a [String],
    ) -> Self {
        self.user_rules = rules;
        self.disabled_profiles = disabled_profiles;
        self
    }

    /// Oferece os arquivos grandes da última varredura como candidatos do tier D.
    /// `now_secs`: agora em segundos Unix, para a idade.
    pub fn with_large_files(mut self, files: &'a [LargeFile], now_secs: u64) -> Self {
        self.large_files = (files, now_secs);
        self
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
        let exclusions = effective_exclusions(&catalog, self.env, baseline, extra);
        let guard = ToolchainGuard::new(self.env.vars(), self.env.path_entries());

        let mut report = ClassificationReport {
            candidates: Vec::new(),
            skipped: Vec::new(),
            exclusions,
            projects: Vec::new(),
            large_files: Vec::new(),
            duplicates: Vec::new(),
        };
        for rule in catalog.rules.iter().chain(self.user_rules) {
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
        for group in self.duplicates {
            for copy in &group.copies {
                let id = format!("dup:{copy}");
                if let Some(ex) = report.exclusions.conflicting(copy) {
                    report.skipped.push(SkippedRule {
                        id,
                        reason: SkipReason::Excluded(ex.reason.clone()),
                    });
                    continue;
                }
                let availability = match guard.blocking_reason(copy, &[]) {
                    Some(reason) => Availability::Blocked { reason },
                    None => Availability::Selectable,
                };
                report.duplicates.push(DuplicateInfo {
                    id: id.clone(),
                    keep: group.keep.clone(),
                });
                report.candidates.push(Candidate {
                    id,
                    label: LocalizedText::same(&path_components(copy).pop().unwrap_or_default()),
                    tier: Tier::D,
                    action: Action::RemovePath { path: copy.clone() },
                    size: group.size,
                    risk: Risk::Low,
                    note: LocalizedText::new(
                        &format!("cópia de {}", group.keep),
                        &format!("copy of {}", group.keep),
                    ),
                    availability,
                });
            }
        }
        let (files, now) = self.large_files;
        for file in files {
            let id = format!("file:{}", file.path);
            if let Some(ex) = report.exclusions.conflicting(&file.path) {
                report.skipped.push(SkippedRule {
                    id,
                    reason: SkipReason::Excluded(ex.reason.clone()),
                });
                continue;
            }
            let availability = match guard.blocking_reason(&file.path, &[]) {
                Some(reason) => Availability::Blocked { reason },
                None => Availability::Selectable,
            };
            let name = path_components(&file.path).pop().unwrap_or_default();
            report.large_files.push(LargeFileInfo {
                id: id.clone(),
                age_days: file
                    .modified
                    .map(|m| u32::try_from(now.saturating_sub(m) / 86_400).unwrap_or(u32::MAX)),
            });
            report.candidates.push(Candidate {
                id,
                label: LocalizedText::same(&name),
                tier: Tier::D,
                action: Action::RemovePath {
                    path: file.path.clone(),
                },
                size: file.size,
                risk: Risk::Low,
                note: LocalizedText::default(),
                availability,
            });
        }
        Ok(report)
    }

    fn find_projects(&self, catalog: &Catalog) -> Vec<FoundArtifact> {
        let Some((finder, extra)) = &self.projects else {
            return Vec::new();
        };
        let profiles: Vec<ProjectProfile> = catalog
            .projects
            .iter()
            .filter(|p| !self.disabled_profiles.contains(&p.id))
            .cloned()
            .collect();
        if profiles.is_empty() {
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
        finder.find(&roots, &profiles)
    }

    fn evaluate_artifact(
        &self,
        id: &str,
        found: &FoundArtifact,
        profile: &ProjectProfile,
        exclusions: &ExclusionList,
        guard: &ToolchainGuard,
    ) -> Result<Candidate, SkipReason> {
        if let Some(ex) = exclusions.conflicting(&found.path) {
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
        if let Some(ex) = exclusions.conflicting(&measured) {
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
