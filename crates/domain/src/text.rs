/// Texto de dado (catálogo, exclusões) nos dois idiomas do app. A interface
/// escolhe o idioma; o domínio nunca formata frase para o usuário.
#[derive(Debug, Clone, Default, PartialEq, Eq, Hash)]
pub struct LocalizedText {
    pub pt: String,
    pub en: String,
}

impl LocalizedText {
    pub fn new(pt: &str, en: &str) -> Self {
        Self {
            pt: pt.to_string(),
            en: en.to_string(),
        }
    }

    /// Mesmo texto nos dois idiomas (nomes próprios: "npm cache", "Gradle").
    pub fn same(text: &str) -> Self {
        Self::new(text, text)
    }
}
