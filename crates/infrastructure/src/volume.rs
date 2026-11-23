use disk_cleanup_application::{PortError, VolumeInfo};
use disk_cleanup_domain::{path_components, path_is_within, ByteSize, VolumeUsage};
use sysinfo::Disks;

/// Capacidade/espaço livre do volume que contém o caminho (ponto de montagem
/// mais específico), via `sysinfo` — Windows, macOS e Linux.
#[derive(Debug, Clone, Copy, Default)]
pub struct SysinfoVolumeInfo;

fn mount_contains(mount: &str, path: &str) -> bool {
    path_components(mount).is_empty() || path_is_within(path, mount)
}

/// `C:` (como o plano guarda o volume) é a raiz da unidade; sem a barra o
/// Windows o trata como "diretório atual da unidade C".
fn normalize(path: &str) -> String {
    let bytes = path.as_bytes();
    if bytes.len() == 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        format!("{path}\\")
    } else {
        path.to_string()
    }
}

impl VolumeInfo for SysinfoVolumeInfo {
    fn usage(&self, path: &str) -> Result<VolumeUsage, PortError> {
        let path = normalize(path);
        // Caminho relativo nunca resolve: no Linux a montagem `/` casaria com ele.
        if !std::path::Path::new(&path).is_absolute() {
            return Err(PortError::NotFound(format!("volume de {path}")));
        }
        let path = path.as_str();
        let disks = Disks::new_with_refreshed_list();
        let disk = disks
            .list()
            .iter()
            .filter(|d| d.total_space() > 0)
            .filter(|d| mount_contains(&d.mount_point().to_string_lossy(), path))
            .max_by_key(|d| path_components(&d.mount_point().to_string_lossy()).len())
            .ok_or_else(|| PortError::NotFound(format!("volume de {path}")))?;
        let total = ByteSize::from_bytes(disk.total_space());
        let free = ByteSize::from_bytes(disk.available_space()).min(total);
        VolumeUsage::new(total, free).map_err(|e| PortError::InvalidData(e.to_string()))
    }
}
