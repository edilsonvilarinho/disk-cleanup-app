use std::fmt;

use disk_cleanup_domain::{
    Action, ApprovedPlan, ByteSize, FailCause, ItemResult, ItemStatus, LocalizedText, PlanItem,
    SafetyGuard, SkipCause, Tier, TierRun,
};

use crate::{ActionRunner, AppError, ExecutionProgress, PortError, VolumeInfo};

/// O que um item vai fazer (dry-run): nenhuma ação é executada.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedStep {
    pub id: String,
    pub label: LocalizedText,
    pub tier: Tier,
    pub kind: &'static str,
    pub target: String,
    pub estimated: ByteSize,
}

/// Executa um tier de um plano **aprovado**, medindo o espaço livre a cada
/// item. Falha de um item vira status dele e nunca aborta o tier.
pub struct ExecuteService<'a> {
    runner: &'a dyn ActionRunner,
    volumes: &'a dyn VolumeInfo,
    guard: &'a SafetyGuard,
    progress: &'a dyn ExecutionProgress,
}

impl<'a> ExecuteService<'a> {
    pub fn new(
        runner: &'a dyn ActionRunner,
        volumes: &'a dyn VolumeInfo,
        guard: &'a SafetyGuard,
        progress: &'a dyn ExecutionProgress,
    ) -> Self {
        Self {
            runner,
            volumes,
            guard,
            progress,
        }
    }

    pub fn preview(
        &self,
        approved: &ApprovedPlan,
        tier: Tier,
    ) -> Result<Vec<PlannedStep>, AppError> {
        Ok(Self::items(approved, tier)?
            .iter()
            .map(|item| PlannedStep {
                id: item.id.clone(),
                label: item.label.clone(),
                tier,
                kind: item.action.kind(),
                target: target_of(&item.action),
                estimated: item.estimated,
            })
            .collect())
    }

    pub fn execute(&self, approved: &ApprovedPlan, tier: Tier) -> Result<TierRun, AppError> {
        let items = Self::items(approved, tier)?;
        let volume = approved.plan().volume();
        let free_before = self.volumes.usage(volume)?.free();
        let mut current = free_before;
        let mut results = Vec::with_capacity(items.len());
        for item in items {
            self.progress.item_started(&item.id);
            let status = self.run(&item.action);
            let after = self
                .volumes
                .usage(volume)
                .map(|u| u.free())
                .unwrap_or(current);
            let result = ItemResult {
                id: item.id.clone(),
                label: item.label.clone(),
                tier,
                estimated: item.estimated,
                free_before: current,
                free_after: after,
                status,
            };
            self.progress.item_finished(&result);
            current = after;
            results.push(result);
        }
        Ok(TierRun {
            tier,
            free_before,
            free_after: current,
            items: results,
        })
    }

    fn items(approved: &ApprovedPlan, tier: Tier) -> Result<&[PlanItem], AppError> {
        let items = approved.plan().items(tier);
        if items.is_empty() {
            return Err(AppError::TierNotApproved(tier));
        }
        Ok(items)
    }

    fn run(&self, action: &Action) -> ItemStatus {
        match action {
            Action::RemovePath { path } => self.remove(path),
            Action::Command { command } => self.command(command),
            Action::Uninstall { .. } => ItemStatus::Skipped {
                cause: SkipCause::UninstallUnsupported,
            },
        }
    }

    fn remove(&self, path: &str) -> ItemStatus {
        if let Err(violation) = self.guard.check(path) {
            return ItemStatus::Skipped {
                cause: SkipCause::Unsafe(violation),
            };
        }
        match self.runner.remove_path(path) {
            Ok(outcome) if outcome.remaining == ByteSize::ZERO && outcome.errors.is_empty() => {
                ItemStatus::Done
            }
            Ok(outcome) => ItemStatus::Partial {
                remaining: outcome.remaining,
                detail: outcome.errors.into_iter().next(),
            },
            Err(PortError::NotFound(_)) => ItemStatus::Skipped {
                cause: SkipCause::Missing,
            },
            Err(e) => ItemStatus::Failed {
                cause: FailCause::Io(port_message(e)),
            },
        }
    }

    fn command(&self, command: &str) -> ItemStatus {
        match self.runner.run_command(command) {
            Ok(outcome) if outcome.success => ItemStatus::Done,
            Ok(outcome) => {
                let last = outcome
                    .output
                    .lines()
                    .rev()
                    .find(|l| !l.trim().is_empty())
                    .unwrap_or("");
                ItemStatus::Failed {
                    cause: FailCause::Exit {
                        code: outcome.code,
                        last_line: last.trim().to_string(),
                    },
                }
            }
            Err(e) => ItemStatus::Failed {
                cause: FailCause::Io(port_message(e)),
            },
        }
    }
}

/// Mensagem crua do sistema, sem o prefixo em português do `Display`.
fn port_message(error: PortError) -> String {
    match error {
        PortError::Io(m)
        | PortError::NotFound(m)
        | PortError::InvalidData(m)
        | PortError::Unsupported(m) => m,
    }
}

fn target_of(action: &Action) -> String {
    match action {
        Action::RemovePath { path } => path.clone(),
        Action::Command { command } => command.clone(),
        Action::Uninstall { display_name, .. } => display_name.clone(),
    }
}

impl fmt::Debug for ExecuteService<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("ExecuteService")
    }
}
