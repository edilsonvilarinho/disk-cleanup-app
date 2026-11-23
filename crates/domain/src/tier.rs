use std::fmt;
use std::str::FromStr;

use crate::DomainError;

/// Nível de risco/natureza de um candidato. A ordem de declaração é a ordem de execução.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Tier {
    /// Cache regenerável.
    A,
    /// Ferramenta removida pelo desinstalador.
    B,
    /// Diretório regenerável com custo de re-download.
    C,
    /// Operação de sistema.
    D,
}

impl Tier {
    pub const ALL: [Tier; 4] = [Tier::A, Tier::B, Tier::C, Tier::D];

    pub const fn letter(self) -> char {
        match self {
            Tier::A => 'A',
            Tier::B => 'B',
            Tier::C => 'C',
            Tier::D => 'D',
        }
    }

    pub const fn description(self) -> &'static str {
        match self {
            Tier::A => "Cache regenerável",
            Tier::B => "Desinstalar",
            Tier::C => "Diretórios regeneráveis",
            Tier::D => "Sistema",
        }
    }
}

impl fmt::Display for Tier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.letter())
    }
}

impl FromStr for Tier {
    type Err = DomainError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_ascii_uppercase().as_str() {
            "A" => Ok(Tier::A),
            "B" => Ok(Tier::B),
            "C" => Ok(Tier::C),
            "D" => Ok(Tier::D),
            _ => Err(DomainError::UnknownTier(s.to_string())),
        }
    }
}
