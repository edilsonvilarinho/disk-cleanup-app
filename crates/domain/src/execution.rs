use crate::{ByteSize, LocalizedText, SafetyViolation, Tier};

/// Variação assinada de espaço livre: positivo = espaço liberado.
pub fn signed_delta(before: ByteSize, after: ByteSize) -> i64 {
    let (b, a) = (i128::from(before.bytes()), i128::from(after.bytes()));
    i64::try_from(a - b).unwrap_or(if a > b { i64::MAX } else { i64::MIN })
}

/// Por que um item não foi executado.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SkipCause {
    /// O caminho já não existe.
    Missing,
    /// Recusado pela guarda de segurança.
    Unsafe(SafetyViolation),
    /// Desinstalação ainda não é executada pelo app.
    UninstallUnsupported,
}

/// Por que um item falhou.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FailCause {
    /// Comando saiu com erro; última linha da saída.
    Exit {
        code: Option<i32>,
        last_line: String,
    },
    /// Erro de E/S, com a mensagem do sistema operacional.
    Io(String),
}

/// Resultado de um item. Item travado não aborta o tier: vira `Partial`/`Failed`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ItemStatus {
    Done,
    /// Parte ficou. `detail` é a mensagem do sistema, quando houver.
    Partial {
        remaining: ByteSize,
        detail: Option<String>,
    },
    Skipped {
        cause: SkipCause,
    },
    Failed {
        cause: FailCause,
    },
}

impl ItemStatus {
    pub fn is_pending(&self) -> bool {
        matches!(self, ItemStatus::Partial { .. } | ItemStatus::Failed { .. })
    }

    /// Código estável para a interface traduzir.
    pub fn code(&self) -> &'static str {
        match self {
            ItemStatus::Done => "ok",
            ItemStatus::Partial { .. } => "partial",
            ItemStatus::Skipped { .. } => "skipped",
            ItemStatus::Failed { .. } => "failed",
        }
    }
}

/// Um item executado, com o espaço livre medido antes e depois dele.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItemResult {
    pub id: String,
    pub label: LocalizedText,
    pub tier: Tier,
    pub estimated: ByteSize,
    pub free_before: ByteSize,
    pub free_after: ByteSize,
    pub status: ItemStatus,
    /// Bytes movidos para a Lixeira: saíram do lugar, mas não liberam espaço
    /// no volume até a Lixeira ser esvaziada.
    pub trashed: ByteSize,
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

    pub fn trashed(&self) -> ByteSize {
        self.items.iter().map(|i| i.trashed).sum()
    }

    pub fn pending(&self) -> Vec<&ItemResult> {
        self.items
            .iter()
            .filter(|i| i.status.is_pending())
            .collect()
    }
}
