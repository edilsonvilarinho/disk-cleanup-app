use std::str::FromStr;

use crate::{DomainError, Tier};

/// Destino do que um tier remove: Lixeira (recuperável até ser esvaziada) ou
/// remoção definitiva. Só vale para caminhos; comando não tem como ir para a Lixeira.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Disposal {
    Permanent,
    Trash,
}

impl Disposal {
    /// Padrão por tier: cache (A) é regenerável e sai de vez; o resto vai para a
    /// Lixeira, porque o custo de errar é maior que o de esvaziá-la depois.
    pub const fn default_for(tier: Tier) -> Self {
        match tier {
            Tier::A => Disposal::Permanent,
            Tier::B | Tier::C | Tier::D => Disposal::Trash,
        }
    }

    /// Código estável para a interface.
    pub const fn code(self) -> &'static str {
        match self {
            Disposal::Permanent => "permanent",
            Disposal::Trash => "trash",
        }
    }
}

impl FromStr for Disposal {
    type Err = DomainError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_ascii_lowercase().as_str() {
            "permanent" => Ok(Disposal::Permanent),
            "trash" => Ok(Disposal::Trash),
            _ => Err(DomainError::UnknownDisposal(s.to_string())),
        }
    }
}
