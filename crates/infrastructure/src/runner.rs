use std::fmt;
use std::fs::{self, Metadata};
use std::path::{Path, PathBuf};
use std::process::Command;

use disk_cleanup_application::{
    ActionRunner, CommandOutcome, PathInspector, PortError, RemovalOutcome,
};
use disk_cleanup_domain::ByteSize;

use crate::{JwalkFileWalker, WalkerPathInspector};

const MAX_ERRORS: usize = 5;
const MAX_OUTPUT_CHARS: usize = 4000;

/// Lixeira do sistema. Move um lote de itens; os que não puderam ir ficam no
/// lugar e o erro descreve o primeiro deles. Existe como ponto de troca para os
/// testes não encherem a Lixeira de quem roda `cargo test`.
pub trait Recycler: Send + Sync + fmt::Debug {
    fn recycle(&self, paths: &[PathBuf]) -> Result<(), String>;
}

/// Lixeira real: Windows (`IFileOperation`), freedesktop no Linux e Finder no macOS.
#[derive(Debug, Clone, Copy, Default)]
pub struct SystemRecycler;

impl Recycler for SystemRecycler {
    fn recycle(&self, paths: &[PathBuf]) -> Result<(), String> {
        trash::delete_all(paths).map_err(|e| match e {
            trash::Error::Os { description, .. } | trash::Error::Unknown { description } => {
                description
                    .trim_start_matches("windows error: ")
                    .to_string()
            }
            other => other.to_string(),
        })
    }
}

/// Remoção best-effort, envio para a Lixeira e execução de comandos.
///
/// - Nunca segue link simbólico nem junção/reparse point: remove o link, não o destino.
/// - Arquivo travado não interrompe: o resto sai e o que ficou é medido.
/// - Arquivo somente leitura é removido (o `std` ignora o atributo; coberto por teste).
#[derive(Debug)]
pub struct FsActionRunner {
    recycler: Box<dyn Recycler>,
}

impl Default for FsActionRunner {
    fn default() -> Self {
        Self::with_recycler(Box::new(SystemRecycler))
    }
}

impl FsActionRunner {
    pub fn with_recycler(recycler: Box<dyn Recycler>) -> Self {
        Self { recycler }
    }

    /// O Windows recusa a pasta inteira quando um arquivo dela está em uso.
    /// Então: tenta o item inteiro; se a pasta for recusada, manda os filhos
    /// num lote só e desce apenas nos que ficaram. Para em `MAX_ERRORS` para
    /// não insistir item a item quando a Lixeira está indisponível no volume.
    fn trash_tree(&self, path: &Path, errors: &mut Vec<String>) {
        if errors.len() >= MAX_ERRORS {
            return;
        }
        let meta = match fs::symlink_metadata(path) {
            Ok(meta) => meta,
            Err(e) => return errors.push(describe(path, &e)),
        };
        if is_link(&meta) {
            // Link não é dado: sai o link, nunca o destino (mesma regra da remoção).
            return remove_link(path, errors);
        }
        let Err(refused) = self.recycler.recycle(&[path.to_path_buf()]) else {
            return;
        };
        if !meta.is_dir() {
            return errors.push(refused);
        }
        let children: Vec<PathBuf> = match fs::read_dir(path) {
            Ok(entries) => entries.flatten().map(|e| e.path()).collect(),
            Err(e) => return errors.push(describe(path, &e)),
        };
        if children.is_empty() {
            return errors.push(refused);
        }
        let before = errors.len();
        // O erro do lote não diz quais ficaram: o que sobrou é inspecionado abaixo.
        let _ = self.recycler.recycle(&children);
        for child in children.iter().filter(|c| fs::symlink_metadata(c).is_ok()) {
            self.trash_tree(child, errors);
        }
        if errors.len() == before {
            if let Err(e) = self.recycler.recycle(&[path.to_path_buf()]) {
                errors.push(e);
            }
        }
    }
}

fn size(path: &str) -> ByteSize {
    WalkerPathInspector::new(JwalkFileWalker)
        .size_of(path)
        .unwrap_or(ByteSize::ZERO)
}

/// Mede antes e depois de `act` e monta o resultado best-effort.
fn measured(
    path: &str,
    act: impl FnOnce(&Path, &mut Vec<String>),
) -> Result<RemovalOutcome, PortError> {
    if fs::symlink_metadata(path).is_err() {
        return Err(PortError::NotFound(path.to_string()));
    }
    let before = size(path);
    let mut errors = Vec::new();
    act(Path::new(path), &mut errors);
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

impl ActionRunner for FsActionRunner {
    fn remove_path(&self, path: &str) -> Result<RemovalOutcome, PortError> {
        measured(path, remove_tree)
    }

    fn trash_path(&self, path: &str) -> Result<RemovalOutcome, PortError> {
        measured(path, |p, errors| self.trash_tree(p, errors))
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

fn is_link(meta: &Metadata) -> bool {
    meta.file_type().is_symlink() || is_reparse_point(meta)
}

/// Link de diretório/junção sai com remove_dir; link de arquivo, com remove_file.
fn remove_link(path: &Path, errors: &mut Vec<String>) {
    if let Err(e) = fs::remove_dir(path).or_else(|_| fs::remove_file(path)) {
        errors.push(describe(path, &e));
    }
}

fn remove_tree(path: &Path, errors: &mut Vec<String>) {
    let meta = match fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(e) => return errors.push(describe(path, &e)),
    };
    if is_link(&meta) {
        return remove_link(path, errors);
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
