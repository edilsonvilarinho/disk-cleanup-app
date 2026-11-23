//! Objetos de transferência para a interface (JSON camelCase). Só mapeamento:
//! nenhuma regra de negócio aqui.

use disk_cleanup_application::{ClassificationReport, SkippedRule, SurveyReport};
use disk_cleanup_domain::{
    Action, AggregateEntry, Availability, Candidate, Exclusion, Plan, Risk, Tier, VolumeHealth,
    VolumeUsage,
};
use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateDto {
    pub id: String,
    pub label: String,
    pub tier: String,
    pub kind: String,
    /// Caminho, comando ou nome do aplicativo, conforme `kind`.
    pub target: String,
    pub size_bytes: u64,
    pub risk: &'static str,
    pub note: String,
    pub blocked_reason: Option<String>,
}

fn risk_name(risk: Risk) -> &'static str {
    match risk {
        Risk::None => "none",
        Risk::Low => "low",
        Risk::Redownload => "redownload",
        Risk::LongRunning => "long-running",
    }
}

impl From<&Candidate> for CandidateDto {
    fn from(c: &Candidate) -> Self {
        let target = match &c.action {
            Action::RemovePath { path } => path.clone(),
            Action::Command { command } => command.clone(),
            Action::Uninstall { display_name, .. } => display_name.clone(),
        };
        let blocked_reason = match &c.availability {
            Availability::Selectable => None,
            Availability::Blocked { reason } => Some(reason.clone()),
        };
        Self {
            id: c.id.clone(),
            label: c.label.clone(),
            tier: c.tier.to_string(),
            kind: c.action.kind().to_string(),
            target,
            size_bytes: c.size.bytes(),
            risk: risk_name(c.risk),
            note: c.note.clone(),
            blocked_reason,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedDto {
    pub id: String,
    pub reason: String,
}

impl From<&SkippedRule> for SkippedDto {
    fn from(s: &SkippedRule) -> Self {
        Self {
            id: s.id.clone(),
            reason: s.reason.to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExclusionDto {
    pub pattern: String,
    pub reason: String,
}

impl From<&Exclusion> for ExclusionDto {
    fn from(e: &Exclusion) -> Self {
        Self {
            pattern: e.pattern.clone(),
            reason: e.reason.clone(),
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
