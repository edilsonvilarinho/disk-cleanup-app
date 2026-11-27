use crate::{signed_delta, ByteSize, ItemResult, TierRun, VolumeUsage};

/// Relatório da sessão: antes/depois do volume e o que cada tier fez.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CleanupReport {
    initial: VolumeUsage,
    runs: Vec<TierRun>,
    last: VolumeUsage,
}

impl CleanupReport {
    pub fn new(initial: VolumeUsage, runs: Vec<TierRun>, last: VolumeUsage) -> Self {
        Self {
            initial,
            runs,
            last,
        }
    }

    pub fn initial(&self) -> &VolumeUsage {
        &self.initial
    }

    pub fn last(&self) -> &VolumeUsage {
        &self.last
    }

    pub fn runs(&self) -> &[TierRun] {
        &self.runs
    }

    pub fn freed(&self) -> i64 {
        signed_delta(self.initial.free(), self.last.free())
    }

    pub fn estimated(&self) -> ByteSize {
        self.runs.iter().map(TierRun::estimated).sum()
    }

    /// Total movido para a Lixeira na sessão (não entra em `freed`).
    pub fn trashed(&self) -> ByteSize {
        self.runs.iter().map(TierRun::trashed).sum()
    }

    pub fn item_count(&self) -> usize {
        self.runs.iter().map(|r| r.items.len()).sum()
    }

    pub fn pending(&self) -> Vec<&ItemResult> {
        self.runs.iter().flat_map(TierRun::pending).collect()
    }
}
