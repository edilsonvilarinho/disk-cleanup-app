use std::fs::{self, Metadata};
use std::path::Path;
use std::process::Command;

use disk_cleanup_application::{
    ActionRunner, CommandOutcome, PathInspector, PortError, RemovalOutcome,
};
use disk_cleanup_domain::ByteSize;

use crate::{JwalkFileWalker, WalkerPathInspector};

const MAX_ERRORS: usize = 5;
const MAX_OUTPUT_CHARS: usize = 4000;

/// Remoção best-effort e execução de comandos.
///
/// - Nunca segue link simbólico nem junção/reparse point: remove o link, não o destino.
/// - Arquivo travado não interrompe: o resto sai e o que ficou é medido.
/// - Arquivo somente leitura é removido (o `std` ignora o atributo; coberto por teste).
#[derive(Debug, Clone, Copy, Default)]
pub struct FsActionRunner;

fn size(path: &str) -> ByteSize {
    WalkerPathInspector::new(JwalkFileWalker)
        .size_of(path)
        .unwrap_or(ByteSize::ZERO)
}

impl ActionRunner for FsActionRunner {
    fn remove_path(&self, path: &str) -> Result<RemovalOutcome, PortError> {
        if fs::symlink_metadata(path).is_err() {
            return Err(PortError::NotFound(path.to_string()));
        }
        let before = size(path);
        let mut errors = Vec::new();
        remove_tree(Path::new(path), &mut errors);
        let remaining = if fs::symlink_metadata(path).is_ok() {
            size(path)
        } else {
            ByteSize::ZERO
        };
        errors.truncate(MAX_ERRORS);
        Ok(RemovalOutcome {
            removed: before.saturating_sub(remaining),
            remaining,
            errors,
        })
    }

    fn run_command(&self, command: &str) -> Result<CommandOutcome, PortError> {
        let output = shell(command)
            .output()
            .map_err(|e| PortError::Io(format!("{command}: {e}")))?;
        let mut text = String::from_utf8_lossy(&output.stdout).into_owned();
        text.push_str(&String::from_utf8_lossy(&output.stderr));
        let skip = text.chars().count().saturating_sub(MAX_OUTPUT_CHARS);
        Ok(CommandOutcome {
            success: output.status.success(),
            code: output.status.code(),
            output: text.chars().skip(skip).collect(),
        })
    }
}

#[cfg(windows)]
fn shell(command: &str) -> Command {
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new("cmd");
    // raw_arg: o cmd recebe a linha como está, sem aspas extras do Rust.
    cmd.arg("/C").raw_arg(command);
    cmd
}

#[cfg(not(windows))]
fn shell(command: &str) -> Command {
    let mut cmd = Command::new("sh");
    cmd.args(["-c", command]);
    cmd
}

#[cfg(windows)]
fn is_reparse_point(meta: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_meta: &Metadata) -> bool {
    false
}

fn describe(path: &Path, e: &std::io::Error) -> String {
    format!("{}: {e}", path.display())
}

fn remove_tree(path: &Path, errors: &mut Vec<String>) {
    let meta = match fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(e) => return errors.push(describe(path, &e)),
    };
    if meta.file_type().is_symlink() || is_reparse_point(&meta) {
        // Link de diretório/junção sai com remove_dir; link de arquivo, com remove_file.
        if let Err(e) = fs::remove_dir(path).or_else(|_| fs::remove_file(path)) {
            errors.push(describe(path, &e));
        }
        return;
    }
    if !meta.is_dir() {
        if let Err(e) = fs::remove_file(path) {
            errors.push(describe(path, &e));
        }
        return;
    }
    let before = errors.len();
    match fs::read_dir(path) {
        Ok(entries) => entries
            .flatten()
            .for_each(|entry| remove_tree(&entry.path(), errors)),
        Err(e) => errors.push(describe(path, &e)),
    }
    // Diretório que não esvaziou por causa de um filho já tem o erro do filho.
    if let Err(e) = fs::remove_dir(path) {
        if errors.len() == before {
            errors.push(describe(path, &e));
        }
    }
}
