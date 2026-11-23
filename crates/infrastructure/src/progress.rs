use disk_cleanup_application::ScanProgress;
use disk_cleanup_domain::ByteSize;

/// Descarta o progresso (CLI sem saída, testes).
#[derive(Debug, Clone, Copy, Default)]
pub struct SilentProgress;

impl ScanProgress for SilentProgress {
    fn scanned(&self, _files: u64, _logical: ByteSize) {}
}
