use crate::{ByteSize, DomainError};

/// Estado de saúde do volume pelo percentual livre.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VolumeHealth {
    /// 20% ou mais livre.
    Healthy,
    /// Entre 10% e 20% livre.
    Warning,
    /// Menos de 10% livre.
    Critical,
}

const CRITICAL_BELOW_PERCENT: f64 = 10.0;
const WARNING_BELOW_PERCENT: f64 = 20.0;

/// Capacidade e espaço livre de um volume. Invariante: `0 < total` e `free <= total`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VolumeUsage {
    total: ByteSize,
    free: ByteSize,
}

impl VolumeUsage {
    pub fn new(total: ByteSize, free: ByteSize) -> Result<Self, DomainError> {
        if total == ByteSize::ZERO {
            return Err(DomainError::InvalidVolume("capacidade total zero".into()));
        }
        if free > total {
            return Err(DomainError::InvalidVolume(format!(
                "livre ({} bytes) maior que o total ({} bytes)",
                free.bytes(),
                total.bytes()
            )));
        }
        Ok(Self { total, free })
    }

    pub fn total(&self) -> ByteSize {
        self.total
    }

    pub fn free(&self) -> ByteSize {
        self.free
    }

    pub fn used(&self) -> ByteSize {
        self.total.saturating_sub(self.free)
    }

    pub fn used_percent(&self) -> f64 {
        self.used().bytes() as f64 * 100.0 / self.total.bytes() as f64
    }

    pub fn free_percent(&self) -> f64 {
        self.free.bytes() as f64 * 100.0 / self.total.bytes() as f64
    }

    pub fn health(&self) -> VolumeHealth {
        let free = self.free_percent();
        if free < CRITICAL_BELOW_PERCENT {
            VolumeHealth::Critical
        } else if free < WARNING_BELOW_PERCENT {
            VolumeHealth::Warning
        } else {
            VolumeHealth::Healthy
        }
    }

    /// Nova medição de espaço livre no mesmo volume, limitada à capacidade.
    pub fn with_free(&self, free: ByteSize) -> Self {
        Self {
            total: self.total,
            free: free.min(self.total),
        }
    }
}
