use std::collections::HashMap;

use crate::{path_components, ByteSize};

/// Nó do mapa do volume. `name` vazio = "outros" (filhos menores e arquivos
/// soltos somados); "outros" nunca tem filhos.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TreeNode {
    pub name: String,
    pub size: ByteSize,
    pub children: Vec<TreeNode>,
}

#[derive(Debug, Default)]
struct Builder {
    name: String,
    size: u64,
    children: HashMap<String, Builder>,
}

/// Árvore de tamanhos para o treemap, montada na mesma passada da varredura.
/// Vai até `max_depth` níveis de pasta abaixo da raiz; ao fechar, cada nó
/// guarda só os `keep` maiores filhos (o resto vira "outros"), o que limita o
/// tamanho a `keep^max_depth` nós.
#[derive(Debug)]
pub struct SizeTree {
    root_key: Vec<String>,
    max_depth: usize,
    keep: usize,
    root: Builder,
}

impl SizeTree {
    pub fn new(root: &str, max_depth: usize, keep: usize) -> Self {
        Self {
            root_key: path_components(root)
                .iter()
                .map(|c| c.to_lowercase())
                .collect(),
            max_depth,
            keep,
            root: Builder {
                name: root.to_string(),
                ..Builder::default()
            },
        }
    }

    /// `components`: caminho completo do arquivo; fora da raiz é ignorado.
    pub fn add_file(&mut self, components: &[String], size: ByteSize) {
        let inside = components.len() > self.root_key.len()
            && self
                .root_key
                .iter()
                .zip(components)
                .all(|(r, c)| c.to_lowercase() == *r);
        if !inside {
            return;
        }
        let bytes = size.bytes();
        self.root.size += bytes;
        let dirs = &components[self.root_key.len()..components.len() - 1];
        let mut node = &mut self.root;
        for dir in dirs.iter().take(self.max_depth) {
            node = node
                .children
                .entry(dir.to_lowercase())
                .or_insert_with(|| Builder {
                    name: dir.clone(),
                    ..Builder::default()
                });
            node.size += bytes;
        }
    }

    pub fn into_root(self) -> TreeNode {
        finish(self.root, self.keep)
    }
}

fn finish(node: Builder, keep: usize) -> TreeNode {
    let mut children: Vec<Builder> = node.children.into_values().collect();
    children.sort_by(|a, b| b.size.cmp(&a.size).then_with(|| a.name.cmp(&b.name)));
    children.truncate(keep);
    let kept: u64 = children.iter().map(|c| c.size).sum();
    let mut out: Vec<TreeNode> = children.into_iter().map(|c| finish(c, keep)).collect();
    let others = node.size.saturating_sub(kept);
    if others > 0 && !out.is_empty() {
        out.push(TreeNode {
            name: String::new(),
            size: ByteSize::from_bytes(others),
            children: Vec::new(),
        });
    }
    TreeNode {
        name: node.name,
        size: ByteSize::from_bytes(node.size),
        children: out,
    }
}
