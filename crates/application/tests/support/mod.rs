//! Implementações falsas das portas, usadas só nos testes.
#![allow(dead_code)]

use std::cell::RefCell;
use std::collections::HashMap;

use disk_cleanup_application::{
    Catalog, CatalogRepository, Environment, FileRecord, FileWalker, PathInspector, PlanCodec,
    PortError, ScanProgress, VolumeInfo, WalkStats,
};
use disk_cleanup_domain::{path_components, ByteSize, Plan, VolumeUsage};

pub fn gib(n: f64) -> ByteSize {
    ByteSize::from_bytes((n * 1024.0 * 1024.0 * 1024.0) as u64)
}

#[derive(Default)]
pub struct FakeWalker {
    pub files: Vec<(String, u64, u64)>,
    pub unreadable: u64,
    pub fail: bool,
    pub modified: Option<u64>,
}

impl FakeWalker {
    pub fn with(files: &[(&str, u64, u64)]) -> Self {
        Self {
            files: files
                .iter()
                .map(|(p, l, a)| (p.to_string(), *l, *a))
                .collect(),
            ..Self::default()
        }
    }
}

impl FileWalker for FakeWalker {
    fn walk(&self, root: &str, sink: &mut dyn FnMut(FileRecord)) -> Result<WalkStats, PortError> {
        if self.fail {
            return Err(PortError::Io(format!("sem acesso a {root}")));
        }
        for (path, logical, allocated) in &self.files {
            sink(FileRecord {
                components: path_components(path),
                logical: ByteSize::from_bytes(*logical),
                allocated: ByteSize::from_bytes(*allocated),
                modified: self.modified,
            });
        }
        Ok(WalkStats {
            files: self.files.len() as u64,
            unreadable: self.unreadable,
        })
    }
}

pub struct FakeVolume(pub Result<VolumeUsage, PortError>);

impl VolumeInfo for FakeVolume {
    fn usage(&self, _volume_root: &str) -> Result<VolumeUsage, PortError> {
        self.0.clone()
    }
}

#[derive(Default)]
pub struct RecordingProgress(pub RefCell<Vec<u64>>);

impl ScanProgress for RecordingProgress {
    fn scanned(&self, files: u64, _logical: ByteSize) {
        self.0.borrow_mut().push(files);
    }
}

#[derive(Default)]
pub struct FakeEnv {
    pub vars: HashMap<String, String>,
    pub path: Vec<String>,
}

impl FakeEnv {
    pub fn with(vars: &[(&str, &str)]) -> Self {
        Self {
            vars: vars
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            path: vec![],
        }
    }
}

impl Environment for FakeEnv {
    fn var(&self, name: &str) -> Option<String> {
        self.vars
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.clone())
    }
    fn vars(&self) -> Vec<(String, String)> {
        self.vars
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    }
    fn path_entries(&self) -> Vec<String> {
        self.path.clone()
    }
}

#[derive(Default)]
pub struct FakeInspector {
    pub sizes: HashMap<String, Result<u64, PortError>>,
}

impl FakeInspector {
    pub fn with(entries: &[(&str, u64)]) -> Self {
        Self {
            sizes: entries
                .iter()
                .map(|(p, s)| (p.to_lowercase(), Ok(*s)))
                .collect(),
        }
    }
}

impl PathInspector for FakeInspector {
    fn exists(&self, path: &str) -> bool {
        self.sizes.contains_key(&path.to_lowercase())
    }
    fn size_of(&self, path: &str) -> Result<ByteSize, PortError> {
        match self.sizes.get(&path.to_lowercase()) {
            Some(Ok(n)) => Ok(ByteSize::from_bytes(*n)),
            Some(Err(e)) => Err(e.clone()),
            None => Err(PortError::NotFound(path.to_string())),
        }
    }
}

pub struct FakeCatalog(pub Result<Catalog, PortError>);

impl CatalogRepository for FakeCatalog {
    fn load(&self) -> Result<Catalog, PortError> {
        self.0.clone()
    }
}

#[derive(Default)]
pub struct FakeCodec;

impl PlanCodec for FakeCodec {
    fn encode(&self, plan: &Plan) -> Result<String, PortError> {
        Ok(format!("{}:{}", plan.volume(), plan.item_count()))
    }
    fn decode(&self, _text: &str) -> Result<Plan, PortError> {
        Err(PortError::InvalidData("não usado".into()))
    }
}
