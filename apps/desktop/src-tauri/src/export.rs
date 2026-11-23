//! Exportação do relatório. A interface manda só os bytes do PNG e um nome
//! sugerido; o caminho sai do diálogo nativo "Salvar como", nunca da WebView.
//! Aqui ficam as regras (testáveis); diálogo e escrita, na raiz de composição.

use std::path::{Path, PathBuf};

use crate::error::ErrorDto;

pub const PNG_SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n'];
/// Teto do cartão-resumo (1200 px × escala 2 fica bem abaixo disso).
pub const MAX_PNG_BYTES: usize = 20 * 1024 * 1024;
const FALLBACK_NAME: &str = "disk-cleanup-relatorio.png";

/// Nome sugerido no diálogo: só `[A-Za-z0-9._-]`, sem caminho, terminando em `.png`.
pub fn suggested_png_name(raw: Option<&str>) -> String {
    let base: String = raw
        .unwrap_or_default()
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or_default()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .take(96)
        .collect();
    let base = base.trim_matches('.');
    if base.is_empty() {
        return FALLBACK_NAME.to_string();
    }
    if base.to_ascii_lowercase().ends_with(".png") {
        base.to_string()
    } else {
        format!("{base}.png")
    }
}

/// Garante a extensão `.png` no caminho escolhido (alguns diálogos não a acrescentam).
pub fn with_png_extension(path: &Path) -> PathBuf {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("png") => path.to_path_buf(),
        _ => {
            let mut name = path.file_name().unwrap_or_default().to_os_string();
            name.push(".png");
            path.with_file_name(name)
        }
    }
}

/// Recusa o que não é PNG ou é grande demais: o comando só grava imagem.
pub fn validate_png(bytes: &[u8]) -> Result<(), ErrorDto> {
    if bytes.len() > MAX_PNG_BYTES {
        return Err(ErrorDto::new("export_too_large").with("bytes", bytes.len()));
    }
    if !bytes.starts_with(&PNG_SIGNATURE) {
        return Err(ErrorDto::new("export_not_png"));
    }
    Ok(())
}
