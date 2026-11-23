use std::fs;
use std::path::Path;

use disk_cleanup_application::{FileWalker, PathInspector, PortError};
use disk_cleanup_domain::ByteSize;

/// Mede caminhos reutilizando o mesmo `FileWalker` da varredura.
#[derive(Debug, Clone, Default)]
pub struct WalkerPathInspector<W> {
    walker: W,
}

impl<W: FileWalker> WalkerPathInspector<W> {
    pub fn new(walker: W) -> Self {
        Self { walker }
    }
}

impl<W: FileWalker> PathInspector for WalkerPathInspector<W> {
    fn exists(&self, path: &str) -> bool {
        Path::new(path).exists()
    }

    fn size_of(&self, path: &str) -> Result<ByteSize, PortError> {
        let meta = fs::symlink_metadata(path).map_err(|_| PortError::NotFound(path.to_string()))?;
        if meta.is_file() {
            return Ok(ByteSize::from_bytes(meta.len()));
        }
        let mut total = ByteSize::ZERO;
        self.walker.walk(path, &mut |file| total += file.logical)?;
        Ok(total)
    }
}
