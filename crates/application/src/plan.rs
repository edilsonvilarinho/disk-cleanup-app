use disk_cleanup_domain::Plan;

use crate::{AppError, PlanCodec};

/// Serializa o plano no formato `plan.json` consumido também pelos scripts da skill.
pub fn export_plan(plan: &Plan, codec: &dyn PlanCodec) -> Result<String, AppError> {
    Ok(codec.encode(plan)?)
}
