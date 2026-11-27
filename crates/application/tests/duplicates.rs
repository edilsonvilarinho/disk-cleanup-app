mod support;

use std::cell::RefCell;
use std::collections::HashMap;

use disk_cleanup_application::{
    Catalog, ClassifyService, ContentHasher, DuplicateService, FileRecord, FileWalker, PortError,
    WalkStats,
};
use disk_cleanup_domain::{path_components, ByteSize, ExclusionList, LocalizedText, Tier};
use support::{FakeCatalog, FakeEnv, FakeInspector};

const MIB: u64 = 1 << 20;

/// Arquivo: (caminho, tamanho lógico, alocado, modificação, conteúdo).
struct Disk(Vec<(&'static str, u64, u64, u64, &'static str)>);

impl FileWalker for Disk {
    fn walk(&self, _: &str, sink: &mut dyn FnMut(FileRecord)) -> Result<WalkStats, PortError> {
        for (p, logical, allocated, modified, _) in &self.0 {
            sink(FileRecord {
                components: path_components(p),
                logical: ByteSize::from_bytes(*logical),
                allocated: ByteSize::from_bytes(*allocated),
                modified: Some(*modified),
            });
        }
        Ok(WalkStats {
            files: self.0.len() as u64,
            unreadable: 0,
        })
    }
}

/// Hasher falso: "conteúdo" vem da tabela; registra o que foi lido.
struct Hasher {
    content: HashMap<String, &'static str>,
    reads: RefCell<Vec<String>>,
}

impl Hasher {
    fn of(disk: &Disk) -> Self {
        Self {
            content: disk
                .0
                .iter()
                .map(|(p, .., c)| ((*p).to_string(), *c))
                .collect(),
            reads: RefCell::default(),
        }
    }
    fn get(&self, path: &str, kind: &str) -> Result<&'static str, PortError> {
        self.reads.borrow_mut().push(format!("{kind} {path}"));
        self.content
            .get(path)
            .copied()
            .ok_or_else(|| PortError::Io(format!("{path}: em uso")))
    }
}

impl ContentHasher for Hasher {
    fn partial(&self, path: &str) -> Result<u64, PortError> {
        // só o "início" do conteúdo
        Ok(self
            .get(path, "partial")?
            .bytes()
            .next()
            .map_or(0, u64::from))
    }
    fn full(&self, path: &str) -> Result<u64, PortError> {
        Ok(self.get(path, "full")?.len() as u64 * 1_000
            + u64::from(self.get(path, "full")?.bytes().last().unwrap_or(0)))
    }
    fn equal(&self, a: &str, b: &str) -> Result<bool, PortError> {
        Ok(self.get(a, "cmp")? == self.get(b, "cmp")?)
    }
}

fn disk() -> Disk {
    Disk(vec![
        // grupo confirmado: 3 cópias; a mais antiga fica
        (
            r"C:\Users\u\Downloads\fotos.zip",
            5 * MIB,
            5 * MIB,
            300,
            "AAAA-1",
        ),
        (
            r"C:\Users\u\Desktop\fotos.zip",
            5 * MIB,
            5 * MIB,
            100,
            "AAAA-1",
        ),
        (
            r"C:\Users\u\Documents\fotos (1).zip",
            5 * MIB,
            5 * MIB,
            200,
            "AAAA-1",
        ),
        // mesmo tamanho, início diferente: cai no hash parcial
        (r"C:\Users\u\a.bin", 5 * MIB, 5 * MIB, 1, "BBBB"),
        // mesmo tamanho e início, fim diferente: cai no hash completo
        (r"C:\Users\u\b.bin", 5 * MIB, 5 * MIB, 1, "AAAA-2"),
        // mesmo hash (falso), conteúdo diferente: cai na comparação byte a byte
        (r"C:\Users\u\c.bin", 5 * MIB, 5 * MIB, 1, "AXXX-1"),
        // pequeno demais
        (r"C:\Users\u\x.txt", 10, 10, 1, "x"),
        (r"C:\Users\u\y.txt", 10, 10, 1, "x"),
        // placeholder de nuvem (alocado 0) e pasta de nuvem: nunca lidos
        (r"C:\Users\u\nuvem.zip", 5 * MIB, 0, 1, "AAAA-1"),
        (
            r"C:\Users\u\OneDrive - Empresa\fotos.zip",
            5 * MIB,
            5 * MIB,
            1,
            "AAAA-1",
        ),
    ])
}

#[test]
fn finds_duplicates_in_four_stages_keeping_the_oldest_copy() {
    let disk = disk();
    let hasher = Hasher::of(&disk);
    let report = DuplicateService::new(&disk, &hasher)
        .run(&[r"C:\Users\u".into()], ByteSize::from_bytes(MIB))
        .unwrap();
    assert_eq!(report.groups.len(), 1);
    let g = &report.groups[0];
    assert_eq!(g.size, ByteSize::from_bytes(5 * MIB));
    assert_eq!(g.keep, r"C:\Users\u\Desktop\fotos.zip");
    assert_eq!(
        g.copies,
        vec![
            r"C:\Users\u\Documents\fotos (1).zip".to_string(),
            r"C:\Users\u\Downloads\fotos.zip".to_string()
        ]
    );
    let s = report.stats;
    assert_eq!(
        (
            s.files,
            s.same_size,
            s.same_partial,
            s.same_full,
            s.confirmed
        ),
        (6, 6, 5, 4, 3)
    );
    let reads = hasher.reads.borrow();
    assert!(!reads
        .iter()
        .any(|r| r.contains("nuvem") || r.contains("OneDrive") || r.contains(".txt")));
}

#[test]
fn unreadable_files_drop_out_and_duplicates_become_tier_d_candidates() {
    let mut disk = disk();
    disk.0
        .push((r"C:\Users\u\travado.zip", 5 * MIB, 5 * MIB, 1, "AAAA-1"));
    let mut hasher = Hasher::of(&disk);
    hasher.content.remove(r"C:\Users\u\travado.zip");
    let report = DuplicateService::new(&disk, &hasher)
        .run(&[r"C:\Users\u".into()], ByteSize::from_bytes(MIB))
        .unwrap();
    assert_eq!(report.groups[0].copies.len(), 2);

    let catalog = FakeCatalog(Ok(Catalog::default()));
    let baseline =
        ExclusionList::default().with(r"C:\Users\u\Documents", LocalizedText::same("docs"));
    let classified = ClassifyService::new(&catalog, &FakeEnv::default(), &FakeInspector::default())
        .with_duplicates(&report.groups)
        .run(baseline, &[])
        .unwrap();
    let ids: Vec<_> = classified
        .candidates
        .iter()
        .map(|c| c.id.as_str())
        .collect();
    // a cópia mantida nunca vira candidato; a excluída vai para "sem candidato"
    assert_eq!(ids, [r"dup:C:\Users\u\Downloads\fotos.zip"]);
    let dup = &classified.candidates[0];
    assert_eq!((dup.tier, dup.size.bytes()), (Tier::D, 5 * MIB));
    assert!(dup.note.pt.contains(r"Desktop\fotos.zip"));
    assert_eq!(
        classified.duplicates[0].keep,
        r"C:\Users\u\Desktop\fotos.zip"
    );
    assert!(classified
        .skipped
        .iter()
        .any(|s| s.id.contains("Documents")));
}
