//! Comparação de caminhos independente de sistema operacional.
//! Caminhos são tratados como listas de segmentos; `\` e `/` são separadores.

const WILDCARD: &str = "*";

/// Nomes que identificam pasta de nuvem. Detecção por NOME, nunca por reparse
/// point: known folders do Windows também são reparse points (pitfall #16).
const CLOUD_NAME_MARKERS: [&str; 6] = [
    "onedrive",
    "google drive",
    "meu drive",
    "dropbox",
    "icloud",
    "box drive",
];

pub fn path_components(path: &str) -> Vec<String> {
    path.split(['\\', '/'])
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

fn segment_matches(segment: &str, pattern: &str) -> bool {
    pattern == WILDCARD || segment.eq_ignore_ascii_case(pattern)
}

/// `true` se `path` é `parent` ou está dentro dele. Comparação por segmento e sem
/// diferenciar maiúsculas; um segmento `*` em `parent` aceita qualquer segmento.
pub fn path_is_within(path: &str, parent: &str) -> bool {
    let path = path_components(path);
    let parent = path_components(parent);
    !parent.is_empty()
        && path.len() >= parent.len()
        && path.iter().zip(&parent).all(|(s, p)| segment_matches(s, p))
}

pub fn is_cloud_folder_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    CLOUD_NAME_MARKERS
        .iter()
        .any(|marker| lower.contains(marker))
}
