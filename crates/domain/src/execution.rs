use crate::{ByteSize, Tier};

/// Variação assinada de espaço livre: positivo = espaço liberado.
pub fn signed_delta(before: ByteSize, after: ByteSize) -> i64 {
    let (b, a) = (i128::from(before.bytes()), i128::from(after.bytes()));
    i64::try_from(a - b).unwrap_or(if a > b { i64::MAX } else { i64::MIN })
}

/// Resultado de um item. Item travado não aborta o tier: vira `Partial`/`Failed`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ItemStatus {
    Done,
    /// Parte ficou (arquivo em uso por processo ativo, permissão).
    Partial {
        remaining: ByteSize,
        detail: String,
    },
    /// Não executado de propósito (guarda de segurança, caminho já ausente).
    Skipped {
        reason: String,
    },
    Failed {
        error: String,
    },
}

impl ItemStatus {
    pub fn is_pending(&self) -> bool {
        matches!(self, ItemStatus::Partial { .. } | ItemStatus::Failed { .. })
    }

    pub fn label(&self) -> &'static str {
        match self {
            ItemStatus::Done => "ok",
            ItemStatus::Partial { .. } => "parcial",
            ItemStatus::Skipped { .. } => "pulado",
            ItemStatus::Failed { .. } => "erro",
        }
    }

    pub fn detail(&self) -> Option<&str> {
        match self {
            ItemStatus::Done => None,
            ItemStatus::Partial { detail, .. } => Some(detail),
            ItemStatus::Skipped { reason } => Some(reason),
            ItemStatus::Failed { error } => Some(error),
        }
    }
}

/// Um item executado, com o espaço livre medido antes e depois dele.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItemResult {
    pub id: String,
    pub label: String,
    pub tier: Tier,
    pub estimated: ByteSize,
    pub free_before: ByteSize,
    pub free_after: ByteSize,
    pub status: ItemStatus,
}

impl ItemResult {
    pub fn freed(&self) -> i64 {
        signed_delta(self.free_before, self.free_after)
    }
}

/// Execução de um tier inteiro, medida antes e depois.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TierRun {
    pub tier: Tier,
    pub free_before: ByteSize,
    pub free_after: ByteSize,
    pub items: Vec<ItemResult>,
}

impl TierRun {
    pub fn freed(&self) -> i64 {
        signed_delta(self.free_before, self.free_after)
    }

    pub fn estimated(&self) -> ByteSize {
        self.items.iter().map(|i| i.estimated).sum()
    }

    pub fn pending(&self) -> Vec<&ItemResult> {
        self.items
            .iter()
            .filter(|i| i.status.is_pending())
            .collect()
    }
}
