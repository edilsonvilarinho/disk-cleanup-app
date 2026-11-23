//! `plan.json` no formato da skill `disk-cleanup` (consumido por `cleanup.ps1`):
//! `{"volume":"C:","tiers":{"A":[{"id","kind":"path","label","path","action":"remove"}]}}`.
//! `estimatedBytes` é um campo extra, ignorado pelos scripts.

use std::collections::BTreeMap;

use disk_cleanup_application::{PlanCodec, PortError};
use disk_cleanup_domain::{Action, ByteSize, LocalizedText, Plan, PlanItem, Tier};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct PlanModel {
    volume: String,
    tiers: BTreeMap<String, Vec<ItemModel>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ItemModel {
    id: String,
    label: String,
    #[serde(flatten)]
    kind: KindModel,
    #[serde(default)]
    estimated_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum KindModel {
    Path {
        path: String,
        #[serde(default = "remove_action")]
        action: String,
    },
    Command {
        command: String,
    },
    Uninstall {
        #[serde(rename = "displayName")]
        display_name: String,
        #[serde(rename = "alsoRemove", default)]
        also_remove: Vec<String>,
    },
}

fn remove_action() -> String {
    "remove".to_string()
}

impl From<&PlanItem> for ItemModel {
    fn from(item: &PlanItem) -> Self {
        let kind = match &item.action {
            Action::RemovePath { path } => KindModel::Path {
                path: path.clone(),
                action: remove_action(),
            },
            Action::Command { command } => KindModel::Command {
                command: command.clone(),
            },
            Action::Uninstall {
                display_name,
                also_remove,
            } => KindModel::Uninstall {
                display_name: display_name.clone(),
                also_remove: also_remove.clone(),
            },
        };
        Self {
            id: item.id.clone(),
            label: item.label.pt.clone(),
            kind,
            estimated_bytes: item.estimated.bytes(),
        }
    }
}

impl From<ItemModel> for PlanItem {
    fn from(model: ItemModel) -> Self {
        let action = match model.kind {
            KindModel::Path { path, .. } => Action::RemovePath { path },
            KindModel::Command { command } => Action::Command { command },
            KindModel::Uninstall {
                display_name,
                also_remove,
            } => Action::Uninstall {
                display_name,
                also_remove,
            },
        };
        Self {
            id: model.id,
            label: LocalizedText::same(&model.label),
            action,
            estimated: ByteSize::from_bytes(model.estimated_bytes),
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct SkillPlanJsonCodec;

impl PlanCodec for SkillPlanJsonCodec {
    fn encode(&self, plan: &Plan) -> Result<String, PortError> {
        let tiers = plan
            .tiers()
            .into_iter()
            .map(|t| {
                (
                    t.to_string(),
                    plan.items(t).iter().map(ItemModel::from).collect(),
                )
            })
            .collect();
        let model = PlanModel {
            volume: plan.volume().to_string(),
            tiers,
        };
        serde_json::to_string_pretty(&model).map_err(|e| PortError::InvalidData(e.to_string()))
    }

    fn decode(&self, text: &str) -> Result<Plan, PortError> {
        let model: PlanModel =
            serde_json::from_str(text).map_err(|e| PortError::InvalidData(e.to_string()))?;
        let mut tiers = BTreeMap::new();
        for (key, items) in model.tiers {
            let tier: Tier = key
                .parse()
                .map_err(|e| PortError::InvalidData(format!("{e}")))?;
            tiers.insert(tier, items.into_iter().map(PlanItem::from).collect());
        }
        Ok(Plan::from_parts(&model.volume, tiers))
    }
}
