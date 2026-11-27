/// Programa registrado no sistema (registro de desinstalação no Windows).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstalledApp {
    pub name: String,
    pub publisher: String,
    /// Pasta de instalação, quando o registro informa.
    pub location: String,
}

/// Minúsculas, só letras e dígitos: "Visual Studio Code" → "visualstudiocode".
fn norm(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

/// Primeira palavra significativa ("Zoom Workplace" → "zoom").
fn first_word(s: &str) -> String {
    s.split(|c: char| !c.is_alphanumeric())
        .find(|w| w.len() >= 3)
        .map(str::to_lowercase)
        .unwrap_or_default()
}

/// A pasta de dados pertence a algum programa instalado? Na dúvida, **sim**:
/// só é sobra o que não casa com nada. Nome curto demais (< 3) é genérico e
/// conta como pertencente.
pub fn belongs_to_installed(folder: &str, apps: &[InstalledApp]) -> bool {
    let f = norm(folder);
    if f.len() < 3 {
        return true;
    }
    apps.iter().any(|app| {
        let name = norm(&app.name);
        let publisher = norm(&app.publisher);
        let location = app
            .location
            .rsplit(['\\', '/'])
            .find(|s| !s.is_empty())
            .map(norm)
            .unwrap_or_default();
        let hit = |other: &str| other.len() >= 3 && (other.contains(&f) || f.contains(other));
        hit(&name)
            || hit(&location)
            || hit(&first_word(&app.name))
            || hit(&first_word(&app.publisher))
            || (!publisher.is_empty() && publisher.starts_with(&f))
    })
}
