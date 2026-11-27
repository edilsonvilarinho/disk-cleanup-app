use std::cmp::Reverse;
use std::collections::BinaryHeap;

use crate::ByteSize;

/// Arquivo grande encontrado na varredura.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LargeFile {
    pub path: String,
    pub size: ByteSize,
    /// Última modificação (segundos Unix), quando o sistema informa.
    pub modified: Option<u64>,
}

/// Os `limit` maiores arquivos com ao menos `min`, sem guardar o volume
/// inteiro na memória: um heap mínimo de tamanho fixo.
#[derive(Debug, Clone)]
pub struct TopFiles {
    limit: usize,
    min: ByteSize,
    heap: BinaryHeap<Reverse<(ByteSize, String, Option<u64>)>>,
}

impl TopFiles {
    pub fn new(limit: usize, min: ByteSize) -> Self {
        Self {
            limit,
            min,
            heap: BinaryHeap::with_capacity(limit + 1),
        }
    }

    /// `path` só é montado se o arquivo entra no top (a varredura passa por
    /// milhões de arquivos; montar o caminho de todos custaria caro).
    pub fn offer(&mut self, path: impl FnOnce() -> String, size: ByteSize, modified: Option<u64>) {
        if self.limit == 0 || size < self.min {
            return;
        }
        if self.heap.len() == self.limit {
            match self.heap.peek() {
                Some(Reverse((smallest, ..))) if size > *smallest => {
                    self.heap.pop();
                }
                _ => return,
            }
        }
        self.heap.push(Reverse((size, path(), modified)));
    }

    /// Do maior para o menor.
    pub fn into_sorted(self) -> Vec<LargeFile> {
        let mut files: Vec<LargeFile> = self
            .heap
            .into_iter()
            .map(|Reverse((size, path, modified))| LargeFile {
                path,
                size,
                modified,
            })
            .collect();
        files.sort_by(|a, b| b.size.cmp(&a.size).then_with(|| a.path.cmp(&b.path)));
        files
    }
}
