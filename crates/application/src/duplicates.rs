//! Duplicados em 4 etapas: tamanho → hash parcial → hash completo → byte a byte.
//! Somente leitura. Placeholder de nuvem nunca é lido (ler baixaria o arquivo).

use std::collections::{BTreeMap, HashMap};
use std::fmt;

use disk_cleanup_domain::{is_cloud_folder_name, ByteSize};

use crate::{AppError, FileWalker, PortError};

/// Lê conteúdo para comparar. `partial` olha só um trecho (início e fim);
/// `full` o arquivo inteiro; `equal` confirma byte a byte.
pub trait ContentHasher {
    fn partial(&self, path: &str) -> Result<u64, PortError>;
    fn full(&self, path: &str) -> Result<u64, PortError>;
    fn equal(&self, a: &str, b: &str) -> Result<bool, PortError>;
}

/// Grupo de arquivos idênticos. `keep` (o mais antigo) nunca vira candidato.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DuplicateGroup {
    pub size: ByteSize,
    pub keep: String,
    pub copies: Vec<String>,
}

/// Quantos arquivos passaram por cada etapa.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct DuplicateStats {
    pub files: u64,
    pub same_size: u64,
    pub same_partial: u64,
    pub same_full: u64,
    pub confirmed: u64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DuplicateReport {
    pub groups: Vec<DuplicateGroup>,
    pub stats: DuplicateStats,
}

#[derive(Debug, Clone)]
struct Entry {
    path: String,
    modified: u64,
    size: u64,
}

pub struct DuplicateService<'a> {
    walker: &'a dyn FileWalker,
    hasher: &'a dyn ContentHasher,
}

impl fmt::Debug for DuplicateService<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("DuplicateService")
    }
}

/// Agrupa por chave e mantém só grupos com 2+ arquivos. Arquivo que não pôde
/// ser lido (em uso, permissão) sai da comparação, sem abortar.
fn regroup(
    groups: Vec<Vec<Entry>>,
    key: impl Fn(&str) -> Result<u64, PortError>,
) -> Vec<Vec<Entry>> {
    let mut out = Vec::new();
    for group in groups {
        let mut by: BTreeMap<u64, Vec<Entry>> = BTreeMap::new();
        for e in group {
            if let Ok(k) = key(&e.path) {
                by.entry(k).or_default().push(e);
            }
        }
        out.extend(by.into_values().filter(|g| g.len() > 1));
    }
    out
}

fn count(groups: &[Vec<Entry>]) -> u64 {
    groups.iter().map(|g| g.len() as u64).sum()
}

fn join(root: &str, components: &[String]) -> String {
    if root.contains(['\\', ':']) {
        components.join("\\")
    } else {
        format!("/{}", components.join("/"))
    }
}

impl<'a> DuplicateService<'a> {
    pub fn new(walker: &'a dyn FileWalker, hasher: &'a dyn ContentHasher) -> Self {
        Self { walker, hasher }
    }

    pub fn run(&self, roots: &[String], min_size: ByteSize) -> Result<DuplicateReport, AppError> {
        let mut by_size: HashMap<u64, Vec<Entry>> = HashMap::new();
        let mut files = 0u64;
        for root in roots {
            self.walker.walk(root, &mut |f| {
                let cloud = f.components.iter().any(|c| is_cloud_folder_name(c));
                if f.logical < min_size || f.allocated == ByteSize::ZERO || cloud {
                    return;
                }
                files += 1;
                by_size.entry(f.logical.bytes()).or_default().push(Entry {
                    path: join(root, &f.components),
                    modified: f.modified.unwrap_or(u64::MAX),
                    size: f.logical.bytes(),
                });
            })?;
        }
        let sizes: Vec<Vec<Entry>> = by_size.into_values().filter(|g| g.len() > 1).collect();
        let same_size = count(&sizes);
        let partial = regroup(sizes, |p| self.hasher.partial(p));
        let same_partial = count(&partial);
        let full = regroup(partial, |p| self.hasher.full(p));
        let same_full = count(&full);

        let mut groups = Vec::new();
        for group in full {
            groups.extend(self.confirm(group).into_iter().map(finish));
        }
        groups.sort_by(|a: &DuplicateGroup, b| {
            let waste = |g: &DuplicateGroup| g.size.bytes() * g.copies.len() as u64;
            waste(b).cmp(&waste(a)).then_with(|| a.keep.cmp(&b.keep))
        });
        let confirmed = groups.iter().map(|g| g.copies.len() as u64 + 1).sum();
        Ok(DuplicateReport {
            groups,
            stats: DuplicateStats {
                files,
                same_size,
                same_partial,
                same_full,
                confirmed,
            },
        })
    }

    /// Separa em classes de conteúdo idêntico (byte a byte); fica só 2+.
    fn confirm(&self, group: Vec<Entry>) -> Vec<Vec<Entry>> {
        let mut classes: Vec<Vec<Entry>> = Vec::new();
        for e in group {
            let home = classes
                .iter_mut()
                .find(|c| self.hasher.equal(&c[0].path, &e.path).unwrap_or(false));
            match home {
                Some(class) => class.push(e),
                None => classes.push(vec![e]),
            }
        }
        classes.into_iter().filter(|c| c.len() > 1).collect()
    }
}

/// A cópia mais antiga (empate: menor caminho) fica; as demais são candidatas.
fn finish(mut class: Vec<Entry>) -> DuplicateGroup {
    class.sort_by(|a, b| {
        a.modified
            .cmp(&b.modified)
            .then_with(|| a.path.cmp(&b.path))
    });
    let first = class.remove(0);
    let mut copies: Vec<String> = class.into_iter().map(|e| e.path).collect();
    copies.sort();
    DuplicateGroup {
        size: ByteSize::from_bytes(first.size),
        keep: first.path,
        copies,
    }
}
