//! Espaço realmente ocupado em disco. Diferente do tamanho lógico para
//! placeholders de nuvem (OneDrive/Google Drive), arquivos comprimidos e esparsos.

use std::fs::Metadata;
use std::path::Path;

/// Windows: `GetCompressedFileSizeW` (≈0 para placeholder de nuvem).
/// Se a consulta falhar, devolve o tamanho lógico (estimativa conservadora).
#[cfg(windows)]
#[allow(unsafe_code)]
pub fn allocated_size(path: &Path, meta: &Metadata) -> u64 {
    use std::os::windows::ffi::OsStrExt;

    use windows_sys::Win32::Foundation::{GetLastError, NO_ERROR};
    use windows_sys::Win32::Storage::FileSystem::{GetCompressedFileSizeW, INVALID_FILE_SIZE};

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut high: u32 = 0;
    // SAFETY: `wide` é terminado em NUL e vive até o fim da chamada;
    // `high` é um u32 válido e exclusivo durante a chamada.
    let low = unsafe { GetCompressedFileSizeW(wide.as_ptr(), &mut high) };
    // SAFETY: leitura do último erro da thread atual, sem pré-condições.
    if low == INVALID_FILE_SIZE && unsafe { GetLastError() } != NO_ERROR {
        return meta.len();
    }
    (u64::from(high) << 32) | u64::from(low)
}

/// Unix: blocos alocados × 512 (definição POSIX de `st_blocks`).
#[cfg(unix)]
pub fn allocated_size(_path: &Path, meta: &Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;
    meta.blocks().saturating_mul(512)
}
