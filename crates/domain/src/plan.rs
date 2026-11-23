use std::collections::{BTreeMap, BTreeSet, HashSet};

use thiserror::Error;

use crate::{Action, ByteSize, Candidate, DomainError, ExclusionList, Tier};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlanItem {
    pub id: String,
    pub label: String,
    pub action: Action,
    pub estimated: ByteSize,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum PlanError {
    #[error("nenhum item selecionado")]
    Empty,
    #[error("candidato desconhecido: {0}")]
    UnknownCandidate(String),
    #[error("candidato selecionado duas vezes: {0}")]
    Duplicate(String),
    #[error("'{id}' está bloqueado: {reason}")]
    Blocked { id: String, reason: String },
    #[error("'{id}' toca caminho excluído {path}: {reason}")]
    Excluded {
        id: String,
        path: String,
        reason: String,
    },
}

/// Plano de limpeza agrupado por tier. Só é construído a partir de candidatos
/// selecionáveis que não tocam caminhos excluídos.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Plan {
    volume: String,
    tiers: BTreeMap<Tier, Vec<PlanItem>>,
}

impl Plan {
    pub fn from_selection(
        volume: &str,
        candidates: &[Candidate],
        selected: &[&str],
        exclusions: &ExclusionList,
    ) -> Result<Self, PlanError> {
        if selected.is_empty() {
            return Err(PlanError::Empty);
        }
        let mut seen = HashSet::new();
        for id in selected {
            if !seen.insert(*id) {
                return Err(PlanError::Duplicate((*id).to_string()));
            }
            let candidate = candidates
                .iter()
                .find(|c| c.id == *id)
                .ok_or_else(|| PlanError::UnknownCandidate((*id).to_string()))?;
            Self::validate(candidate, exclusions)?;
        }
        let mut tiers: BTreeMap<Tier, Vec<PlanItem>> = BTreeMap::new();
        for c in candidates.iter().filter(|c| seen.contains(c.id.as_str())) {
            tiers.entry(c.tier).or_default().push(PlanItem {
                id: c.id.clone(),
                label: c.label.clone(),
                action: c.action.clone(),
                estimated: c.size,
            });
        }
        Ok(Self {
            volume: volume.to_string(),
            tiers,
        })
    }

    /// Reconstrói um plano já validado (ex.: lido de `plan.json`).
    pub fn from_parts(volume: &str, tiers: BTreeMap<Tier, Vec<PlanItem>>) -> Self {
        let tiers = tiers
            .into_iter()
            .filter(|(_, items)| !items.is_empty())
            .collect();
        Self {
            volume: volume.to_string(),
            tiers,
        }
    }

    fn validate(candidate: &Candidate, exclusions: &ExclusionList) -> Result<(), PlanError> {
        if let crate::Availability::Blocked { reason } = &candidate.availability {
            return Err(PlanError::Blocked {
                id: candidate.id.clone(),
                reason: reason.clone(),
            });
        }
        for path in candidate.action.touched_paths() {
            if let Some(ex) = exclusions.matching(path) {
                return Err(PlanError::Excluded {
                    id: candidate.id.clone(),
                    path: path.to_string(),
                    reason: ex.reason.clone(),
                });
            }
        }
        Ok(())
    }

    pub fn volume(&self) -> &str {
        &self.volume
    }

    pub fn tiers(&self) -> Vec<Tier> {
        self.tiers.keys().copied().collect()
    }

    pub fn items(&self, tier: Tier) -> &[PlanItem] {
        self.tiers.get(&tier).map_or(&[], Vec::as_slice)
    }

    pub fn item_count(&self) -> usize {
        self.tiers.values().map(Vec::len).sum()
    }

    pub fn estimated_size(&self, tier: Tier) -> ByteSize {
        self.items(tier).iter().map(|i| i.estimated).sum()
    }

    pub fn estimated_total(&self) -> ByteSize {
        self.tiers()
            .into_iter()
            .map(|t| self.estimated_size(t))
            .sum()
    }

    fn restricted_to(&self, tiers: &BTreeSet<Tier>) -> Self {
        let kept = self
            .tiers
            .iter()
            .filter(|(t, _)| tiers.contains(t))
            .map(|(t, i)| (*t, i.clone()))
            .collect();
        Self {
            volume: self.volume.clone(),
            tiers: kept,
        }
    }
}

/// Pergunta que o usuário precisa responder antes de executar (pitfalls #4 e #5).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Decision {
    pub id: String,
    pub question: String,
    pub options: Vec<String>,
    recommended: Option<usize>,
    chosen: Option<usize>,
}

impl Decision {
    pub fn new(id: &str, question: &str, options: Vec<String>, recommended: Option<usize>) -> Self {
        Self {
            id: id.to_string(),
            question: question.to_string(),
            options,
            recommended,
            chosen: None,
        }
    }

    pub fn choose(&mut self, index: usize) -> Result<(), DomainError> {
        if index >= self.options.len() {
            return Err(DomainError::InvalidChoice {
                decision: self.id.clone(),
                index,
            });
        }
        self.chosen = Some(index);
        Ok(())
    }

    pub fn is_decided(&self) -> bool {
        self.chosen.is_some()
    }

    pub fn chosen_option(&self) -> Option<&str> {
        self.chosen.map(|i| self.options[i].as_str())
    }

    pub fn recommended(&self) -> Option<usize> {
        self.recommended
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ApprovalError {
    #[error("decisões pendentes: {}", .0.join(", "))]
    PendingDecisions(Vec<String>),
    #[error("nenhum tier aprovado")]
    NoTierApproved,
    #[error("revisão do plano não confirmada")]
    NotAcknowledged,
    #[error("tier {0} não existe no plano")]
    TierNotInPlan(Tier),
}

/// Plano aprovado explicitamente, restrito aos tiers autorizados.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApprovedPlan {
    plan: Plan,
}

impl ApprovedPlan {
    pub fn plan(&self) -> &Plan {
        &self.plan
    }
}

/// Único caminho para obter um `ApprovedPlan`: nada executa sem aprovação.
pub fn approve(
    plan: &Plan,
    decisions: &[Decision],
    tiers: &BTreeSet<Tier>,
    acknowledged: bool,
) -> Result<ApprovedPlan, ApprovalError> {
    let pending: Vec<String> = decisions
        .iter()
        .filter(|d| !d.is_decided())
        .map(|d| d.id.clone())
        .collect();
    if !pending.is_empty() {
        return Err(ApprovalError::PendingDecisions(pending));
    }
    if tiers.is_empty() {
        return Err(ApprovalError::NoTierApproved);
    }
    if let Some(missing) = tiers.iter().find(|t| plan.items(**t).is_empty()) {
        return Err(ApprovalError::TierNotInPlan(*missing));
    }
    if !acknowledged {
        return Err(ApprovalError::NotAcknowledged);
    }
    Ok(ApprovedPlan {
        plan: plan.restricted_to(tiers),
    })
}
