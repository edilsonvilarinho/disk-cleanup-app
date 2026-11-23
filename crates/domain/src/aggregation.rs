use std::collections::BTreeMap;

use crate::{is_cloud_folder_name, path_components, ByteSize};

/// Raiz de agregação: soma os arquivos sob `root` agrupando pelos primeiros
/// `depth` segmentos relativos a ela.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FocusRoot {
    id: String,
    root: Vec<String>,
    depth: usize,
}

impl FocusRoot {
    pub fn new(id: &str, root: &str, depth: usize) -> Self {
        Self {
            id: id.to_string(),
            root: path_components(root),
            depth: depth.max(1),
        }
    }

    /// Segmentos de `components` relativos à raiz, ou `None` se estiver fora dela.
    fn relative<'a>(&self, components: &'a [String]) -> Option<&'a [String]> {
        let inside = components.len() > self.root.len()
            && components
                .iter()
                .zip(&self.root)
                .all(|(c, r)| c.eq_ignore_ascii_case(r));
        inside.then(|| &components[self.root.len()..])
    }
}

/// Totais de um agrupamento.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AggregateEntry {
    /// Segmentos relativos à raiz de foco.
    pub key: Vec<String>,
    /// Soma dos tamanhos lógicos (o que o Explorer mostra).
    pub logical: ByteSize,
    /// Soma do espaço realmente alocado em disco.
    pub allocated: ByteSize,
    pub files: u64,
}

impl AggregateEntry {
    pub fn name(&self) -> &str {
        self.key.last().map_or("", String::as_str)
    }

    pub fn is_cloud(&self) -> bool {
        self.key.iter().any(|segment| is_cloud_folder_name(segment))
    }

    /// Bytes que existem só na nuvem (placeholder): lógico − alocado.
    pub fn placeholder(&self) -> ByteSize {
        self.logical.saturating_sub(self.allocated)
    }
}

#[derive(Debug, Clone, Copy, Default)]
struct Totals {
    logical: ByteSize,
    allocated: ByteSize,
    files: u64,
}

/// Agregador de varredura única: cada arquivo visitado alimenta todas as raízes
/// de foco que o contêm (evita o "Get-ChildItem -Recurse em loop").
#[derive(Debug, Clone, Default)]
pub struct SizeAggregator {
    focuses: Vec<FocusRoot>,
    totals: Vec<BTreeMap<Vec<String>, Totals>>,
}

impl SizeAggregator {
    pub fn new(focuses: Vec<FocusRoot>) -> Self {
        let totals = vec![BTreeMap::new(); focuses.len()];
        Self { focuses, totals }
    }

    pub fn add_file(&mut self, components: &[String], logical: ByteSize, allocated: ByteSize) {
        for (focus, map) in self.focuses.iter().zip(self.totals.iter_mut()) {
            let Some(relative) = focus.relative(components) else {
                continue;
            };
            let key = relative[..focus.depth.min(relative.len())].to_vec();
            let entry = map.entry(key).or_default();
            entry.logical += logical;
            entry.allocated += allocated;
            entry.files += 1;
        }
    }

    /// Entradas da raiz `id`, da maior para a menor (empate: ordem alfabética).
    pub fn entries(&self, id: &str) -> Vec<AggregateEntry> {
        let Some(map) = self.map_of(id) else {
            return Vec::new();
        };
        let mut entries: Vec<_> = map
            .iter()
            .map(|(key, t)| AggregateEntry {
                key: key.clone(),
                logical: t.logical,
                allocated: t.allocated,
                files: t.files,
            })
            .collect();
        entries.sort_by(|a, b| b.logical.cmp(&a.logical).then_with(|| a.key.cmp(&b.key)));
        entries
    }

    pub fn total(&self, id: &str) -> ByteSize {
        self.map_of(id)
            .map_or(ByteSize::ZERO, |m| m.values().map(|t| t.logical).sum())
    }

    fn map_of(&self, id: &str) -> Option<&BTreeMap<Vec<String>, Totals>> {
        self.focuses
            .iter()
            .position(|f| f.id == id)
            .map(|i| &self.totals[i])
    }
}
