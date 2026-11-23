//! Objetos de transferência para a interface (JSON camelCase). Só mapeamento:
//! nenhuma regra de negócio e nenhuma frase pronta — textos vão em `{pt, en}`
//! e motivos vão como código + detalhe, traduzidos pela interface.

use disk_cleanup_application::{
    ClassificationReport, PlannedStep, SkipReason, SkippedRule, SurveyReport,
};
use disk_cleanup_domain::{
    Action, AggregateEntry, ApprovedPlan, Availability, BlockReason, Candidate, CleanupReport,
    Exclusion, FailCause, ItemResult, ItemStatus, LocalizedText, Plan, Risk, SafetyViolation,
    SkipCause, Tier, TierRun, VolumeHealth, VolumeUsage,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TextDto {
    pub pt: String,
    pub en: String,
}

impl From<&LocalizedText> for TextDto {
    fn from(t: &LocalizedText) -> Self {
        Self {
            pt: t.pt.clone(),
            en: t.en.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfoDto {
    pub os: String,
    pub volume_root: String,
    pub profile: Option<String>,
    pub catalog: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyRequestDto {
    pub volume_root: String,
    pub profile: Option<String>,
    pub depth: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeDto {
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub used_percent: f64,
    pub free_percent: f64,
    pub health: &'static str,
}

impl From<&VolumeUsage> for VolumeDto {
    fn from(v: &VolumeUsage) -> Self {
        Self {
            total_bytes: v.total().bytes(),
            free_bytes: v.free().bytes(),
            used_bytes: v.used().bytes(),
            used_percent: v.used_percent(),
            free_percent: v.free_percent(),
            health: match v.health() {
                VolumeHealth::Healthy => "healthy",
                VolumeHealth::Warning => "warning",
                VolumeHealth::Critical => "critical",
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageEntryDto {
    pub key: Vec<String>,
    pub name: String,
    pub logical_bytes: u64,
    pub allocated_bytes: u64,
    pub placeholder_bytes: u64,
    pub files: u64,
    pub is_cloud: bool,
}

impl From<&AggregateEntry> for UsageEntryDto {
    fn from(e: &AggregateEntry) -> Self {
        Self {
            key: e.key.clone(),
            name: e.name().to_string(),
            logical_bytes: e.logical.bytes(),
            allocated_bytes: e.allocated.bytes(),
            placeholder_bytes: e.placeholder().bytes(),
            files: e.files,
            is_cloud: e.is_cloud(),
        }
    }
}

fn entries(list: &[AggregateEntry]) -> Vec<UsageEntryDto> {
    list.iter().map(UsageEntryDto::from).collect()
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyDto {
    pub volume: VolumeDto,
    pub roots: Vec<UsageEntryDto>,
    pub children: Vec<UsageEntryDto>,
    pub profile: Vec<UsageEntryDto>,
    pub cloud: Vec<UsageEntryDto>,
    pub files: u64,
    pub unreadable: u64,
    pub unattributed_bytes: u64,
    pub elapsed_ms: u64,
}

impl SurveyDto {
    pub fn from_report(report: &SurveyReport, elapsed_ms: u64) -> Self {
        Self {
            volume: VolumeDto::from(&report.volume),
            roots: entries(&report.roots),
            children: entries(&report.children),
            profile: entries(&report.profile),
            cloud: entries(&report.cloud),
            files: report.files,
            unreadable: report.unreadable,
            unattributed_bytes: report.unattributed.bytes(),
            elapsed_ms,
        }
    }
}

/// Por que um candidato está bloqueado: `env_var` (nome) ou `path_entry` (entrada).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BlockDto {
    pub code: &'static str,
    pub value: String,
}

impl From<&BlockReason> for BlockDto {
    fn from(r: &BlockReason) -> Self {
        match r {
            BlockReason::EnvVar { name } => Self {
                code: "env_var",
                value: name.clone(),
            },
            BlockReason::PathEntry { entry } => Self {
                code: "path_entry",
                value: entry.clone(),
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateDto {
    pub id: String,
    pub label: TextDto,
    pub tier: String,
    pub kind: String,
    /// Caminho, comando ou nome do aplicativo, conforme `kind`.
    pub target: String,
    pub size_bytes: u64,
    pub risk: &'static str,
    pub note: TextDto,
    pub blocked: Option<BlockDto>,
}

fn risk_name(risk: Risk) -> &'static str {
    match risk {
        Risk::None => "none",
        Risk::Low => "low",
        Risk::Redownload => "redownload",
        Risk::LongRunning => "long-running",
    }
}

fn target_of(action: &Action) -> String {
    match action {
        Action::RemovePath { path } => path.clone(),
        Action::Command { command } => command.clone(),
        Action::Uninstall { display_name, .. } => display_name.clone(),
    }
}

impl From<&Candidate> for CandidateDto {
    fn from(c: &Candidate) -> Self {
        Self {
            id: c.id.clone(),
            label: TextDto::from(&c.label),
            tier: c.tier.to_string(),
            kind: c.action.kind().to_string(),
            target: target_of(&c.action),
            size_bytes: c.size.bytes(),
            risk: risk_name(c.risk),
            note: TextDto::from(&c.note),
            blocked: match &c.availability {
                Availability::Selectable => None,
                Availability::Blocked { reason } => Some(BlockDto::from(reason)),
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SkippedDto {
    pub id: String,
    /// `not_found` | `empty` | `unresolved_variable` | `excluded` | `unmeasurable`.
    pub code: &'static str,
    /// Caminho, variável ou mensagem do sistema, conforme o código.
    pub detail: Option<String>,
    /// Motivo da exclusão, quando `excluded`.
    pub reason: Option<TextDto>,
}

impl From<&SkippedRule> for SkippedDto {
    fn from(s: &SkippedRule) -> Self {
        let (code, detail, reason) = match &s.reason {
            SkipReason::NotFound(p) => ("not_found", Some(p.clone()), None),
            SkipReason::Empty => ("empty", None, None),
            SkipReason::UnresolvedVariable(v) => ("unresolved_variable", Some(v.clone()), None),
            SkipReason::Excluded(r) => ("excluded", None, Some(TextDto::from(r))),
            SkipReason::Unmeasurable(e) => ("unmeasurable", Some(e.clone()), None),
        };
        Self {
            id: s.id.clone(),
            code,
            detail,
            reason,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ExclusionDto {
    pub pattern: String,
    pub reason: TextDto,
}

impl From<&Exclusion> for ExclusionDto {
    fn from(e: &Exclusion) -> Self {
        Self {
            pattern: e.pattern.clone(),
            reason: TextDto::from(&e.reason),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationDto {
    pub candidates: Vec<CandidateDto>,
    pub skipped: Vec<SkippedDto>,
    pub exclusions: Vec<ExclusionDto>,
    pub selectable_bytes: u64,
}

impl From<&ClassificationReport> for ClassificationDto {
    fn from(r: &ClassificationReport) -> Self {
        Self {
            candidates: r.candidates.iter().map(CandidateDto::from).collect(),
            skipped: r.skipped.iter().map(SkippedDto::from).collect(),
            exclusions: r
                .exclusions
                .entries()
                .iter()
                .map(ExclusionDto::from)
                .collect(),
            selectable_bytes: r.selectable_total().bytes(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanTierDto {
    pub tier: String,
    pub item_count: usize,
    pub estimated_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanDto {
    pub item_count: usize,
    pub estimated_bytes: u64,
    pub tiers: Vec<PlanTierDto>,
    /// `plan.json` no formato da skill.
    pub json: String,
}

impl PlanDto {
    pub fn new(plan: &Plan, json: String) -> Self {
        let tiers = plan
            .tiers()
            .into_iter()
            .map(|t: Tier| PlanTierDto {
                tier: t.to_string(),
                item_count: plan.items(t).len(),
                estimated_bytes: plan.estimated_size(t).bytes(),
            })
            .collect();
        Self {
            item_count: plan.item_count(),
            estimated_bytes: plan.estimated_total().bytes(),
            tiers,
            json,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalDto {
    pub tiers: Vec<String>,
    pub item_count: usize,
    pub estimated_bytes: u64,
}

impl From<&ApprovedPlan> for ApprovalDto {
    fn from(a: &ApprovedPlan) -> Self {
        let plan = a.plan();
        Self {
            tiers: plan.tiers().iter().map(Tier::to_string).collect(),
            item_count: plan.item_count(),
            estimated_bytes: plan.estimated_total().bytes(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepDto {
    pub id: String,
    pub label: TextDto,
    pub tier: String,
    pub kind: &'static str,
    pub target: String,
    pub estimated_bytes: u64,
}

impl From<&PlannedStep> for StepDto {
    fn from(s: &PlannedStep) -> Self {
        Self {
            id: s.id.clone(),
            label: TextDto::from(&s.label),
            tier: s.tier.to_string(),
            kind: s.kind,
            target: s.target.clone(),
            estimated_bytes: s.estimated.bytes(),
        }
    }
}

/// Causa de um item que não terminou `ok`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CauseDto {
    /// `partial_os` | `partial_locked` | `missing` | `too_broad` | `protected` |
    /// `uninstall_unsupported` | `io` | `exit`.
    pub code: &'static str,
    pub detail: Option<String>,
    pub exit_code: Option<i32>,
}

impl CauseDto {
    fn of(status: &ItemStatus) -> Option<Self> {
        let (code, detail, exit_code) = match status {
            ItemStatus::Done => return None,
            ItemStatus::Partial {
                detail: Some(d), ..
            } => ("partial_os", Some(d.clone()), None),
            ItemStatus::Partial { detail: None, .. } => ("partial_locked", None, None),
            ItemStatus::Skipped {
                cause: SkipCause::Missing,
            } => ("missing", None, None),
            ItemStatus::Skipped {
                cause: SkipCause::UninstallUnsupported,
            } => ("uninstall_unsupported", None, None),
            ItemStatus::Skipped {
                cause: SkipCause::Unsafe(SafetyViolation::TooBroad { target }),
            } => ("too_broad", Some(target.clone()), None),
            ItemStatus::Skipped {
                cause: SkipCause::Unsafe(SafetyViolation::Protected { path }),
            } => ("protected", Some(path.clone()), None),
            ItemStatus::Failed {
                cause: FailCause::Io(m),
            } => ("io", Some(m.clone()), None),
            ItemStatus::Failed {
                cause: FailCause::Exit { code, last_line },
            } => ("exit", Some(last_line.clone()), *code),
        };
        Some(Self {
            code,
            detail,
            exit_code,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemResultDto {
    pub id: String,
    pub label: TextDto,
    pub tier: String,
    pub estimated_bytes: u64,
    /// Espaço livre ganho (negativo se o volume encheu durante o item).
    pub freed_bytes: i64,
    /// `ok` | `partial` | `skipped` | `failed`.
    pub status: &'static str,
    pub cause: Option<CauseDto>,
}

impl From<&ItemResult> for ItemResultDto {
    fn from(r: &ItemResult) -> Self {
        Self {
            id: r.id.clone(),
            label: TextDto::from(&r.label),
            tier: r.tier.to_string(),
            estimated_bytes: r.estimated.bytes(),
            freed_bytes: r.freed(),
            status: r.status.code(),
            cause: CauseDto::of(&r.status),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TierRunDto {
    pub tier: String,
    pub free_before_bytes: u64,
    pub free_after_bytes: u64,
    pub freed_bytes: i64,
    pub estimated_bytes: u64,
    pub items: Vec<ItemResultDto>,
}

impl From<&TierRun> for TierRunDto {
    fn from(r: &TierRun) -> Self {
        Self {
            tier: r.tier.to_string(),
            free_before_bytes: r.free_before.bytes(),
            free_after_bytes: r.free_after.bytes(),
            freed_bytes: r.freed(),
            estimated_bytes: r.estimated().bytes(),
            items: r.items.iter().map(ItemResultDto::from).collect(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionEventDto {
    /// `started` ou `finished`.
    pub kind: &'static str,
    pub id: String,
    pub result: Option<ItemResultDto>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportDto {
    pub initial: VolumeDto,
    pub last: VolumeDto,
    pub freed_bytes: i64,
    pub estimated_bytes: u64,
    pub item_count: usize,
    pub runs: Vec<TierRunDto>,
    pub pending: Vec<ItemResultDto>,
    /// Candidatos bloqueados (PATH/variável): mantidos de propósito.
    pub blocked: Vec<CandidateDto>,
    /// Exclusões: nunca tocadas.
    pub exclusions: Vec<ExclusionDto>,
}

impl ReportDto {
    pub fn new(report: &CleanupReport, classification: Option<&ClassificationReport>) -> Self {
        let blocked = classification
            .map(|c| {
                c.candidates
                    .iter()
                    .filter(|x| !x.availability.is_selectable())
                    .map(CandidateDto::from)
                    .collect()
            })
            .unwrap_or_default();
        let exclusions = classification
            .map(|c| {
                c.exclusions
                    .entries()
                    .iter()
                    .map(ExclusionDto::from)
                    .collect()
            })
            .unwrap_or_default();
        Self {
            initial: VolumeDto::from(report.initial()),
            last: VolumeDto::from(report.last()),
            freed_bytes: report.freed(),
            estimated_bytes: report.estimated().bytes(),
            item_count: report.item_count(),
            runs: report.runs().iter().map(TierRunDto::from).collect(),
            pending: report
                .pending()
                .into_iter()
                .map(ItemResultDto::from)
                .collect(),
            blocked,
            exclusions,
        }
    }
}
