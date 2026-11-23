use std::iter::Sum;
use std::ops::{Add, AddAssign};

const BYTES_PER_GIB: f64 = 1024.0 * 1024.0 * 1024.0;

/// Quantidade de bytes. Soma satura em `u64::MAX` em vez de estourar.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ByteSize(u64);

impl ByteSize {
    pub const ZERO: ByteSize = ByteSize(0);

    pub const fn from_bytes(bytes: u64) -> Self {
        Self(bytes)
    }

    pub const fn bytes(self) -> u64 {
        self.0
    }

    /// Gibibytes (1024³), a mesma unidade que o PowerShell chama de `1GB`.
    pub fn gib(self) -> f64 {
        self.0 as f64 / BYTES_PER_GIB
    }

    pub const fn saturating_sub(self, other: Self) -> Self {
        Self(self.0.saturating_sub(other.0))
    }
}

impl Add for ByteSize {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        Self(self.0.saturating_add(rhs.0))
    }
}

impl AddAssign for ByteSize {
    fn add_assign(&mut self, rhs: Self) {
        *self = *self + rhs;
    }
}

impl Sum for ByteSize {
    fn sum<I: Iterator<Item = Self>>(iter: I) -> Self {
        iter.fold(Self::ZERO, Add::add)
    }
}
