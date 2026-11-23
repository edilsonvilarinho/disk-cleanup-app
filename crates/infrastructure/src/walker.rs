use std::fs;
use std::path::Path;

use disk_cleanup_application::{FileRecord, FileWalker, PortError, WalkStats};
use disk_cleanup_domain::{path_components, ByteSize};
use jwalk::WalkDirGeneric;

use crate::allocated_size;

/// `(lógico, alocado)` calculado nas threads de leitura do jwalk.
type Sizes = Option<(u64, u64)>;

/// Varredura paralela: diretórios são lidos em várias threads e os metadados
/// de cada arquivo são obtidos já nessas threads (`process_read_dir`).
#[derive(Debug, Clone, Copy, Default)]
pub struct JwalkFileWalker;

impl FileWalker for JwalkFileWalker {
    fn walk(&self, root: &str, sink: &mut dyn FnMut(FileRecord)) -> Result<WalkStats, PortError> {
        let root_path = Path::new(root);
        if !root_path.exists() {
            return Err(PortError::NotFound(root.to_string()));
        }
        let walk = WalkDirGeneric::<((), Sizes)>::new(root_path)
            .skip_hidden(false)
            .follow_links(false)
            .process_read_dir(|_depth, _dir, _state, children| {
                for child in children.iter_mut().flatten() {
                    if child.file_type.is_file() {
                        let path = child.path();
                        child.client_state = fs::symlink_metadata(&path)
                            .ok()
                            .map(|m| (m.len(), allocated_size(&path, &m)));
                    }
                }
            });

        let mut stats = WalkStats::default();
        for entry in walk {
            let Ok(entry) = entry else {
                stats.unreadable += 1;
                continue;
            };
            // Diretório que não pôde ser listado: o jwalk guarda a falha aqui.
            if entry.read_children_error.is_some() {
                stats.unreadable += 1;
                continue;
            }
            if !entry.file_type.is_file() {
                continue;
            }
            let Some((logical, allocated)) = entry.client_state else {
                stats.unreadable += 1;
                continue;
            };
            stats.files += 1;
            sink(FileRecord {
                components: path_components(&entry.path().to_string_lossy()),
                logical: ByteSize::from_bytes(logical),
                allocated: ByteSize::from_bytes(allocated),
            });
        }
        Ok(stats)
    }
}
