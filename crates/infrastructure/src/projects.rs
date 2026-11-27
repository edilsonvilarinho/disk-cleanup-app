use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use disk_cleanup_application::{FoundArtifact, ProjectFinder, ProjectProfile};

use crate::runner::is_link;

/// Profundidade da atividade: arquivos até `raiz/a/b` contam para a idade.
const ACTIVITY_DEPTH: usize = 2;

/// Procura projetos por marcador (`package.json`, `Cargo.toml`, `*.csproj`...).
///
/// - Nunca segue link simbólico nem junção.
/// - Nunca desce em artefato (`node_modules` de um projeto não é varrido) nem
///   em pasta oculta (`.git`, `.cache`); artefato oculto (`.venv`, `.next`) é
///   reconhecido pelo nome na raiz do projeto.
/// - Idade: dias desde o arquivo mais recente do projeto até `raiz/a/b`, fora
///   dos artefatos, ou o `.git/index` (muda a cada commit/add).
#[derive(Debug, Clone, Copy)]
pub struct FsProjectFinder {
    now: SystemTime,
    max_depth: usize,
}

impl Default for FsProjectFinder {
    fn default() -> Self {
        Self::at(SystemTime::now(), 6)
    }
}

impl FsProjectFinder {
    /// `max_depth`: níveis abaixo de cada pasta de projetos.
    pub fn at(now: SystemTime, max_depth: usize) -> Self {
        Self { now, max_depth }
    }
}

struct Walk<'a> {
    profiles: &'a [ProjectProfile],
    artifacts: HashSet<&'a str>,
    seen: HashSet<PathBuf>,
    out: Vec<FoundArtifact>,
}

fn marker_matches(marker: &str, name: &str) -> bool {
    match marker.strip_prefix('*') {
        Some(suffix) => name.len() > suffix.len() && name.ends_with(suffix),
        None => marker == name,
    }
}

/// Subpastas que podem ser varridas: nem link, nem oculta, nem artefato.
fn walkable(entry: &fs::DirEntry, artifacts: &HashSet<&str>) -> Option<PathBuf> {
    let name = entry.file_name().to_string_lossy().into_owned();
    let meta = fs::symlink_metadata(entry.path()).ok()?;
    let ok = meta.is_dir()
        && !is_link(&meta)
        && !name.starts_with('.')
        && !artifacts.contains(name.as_str());
    ok.then(|| entry.path())
}

impl FsProjectFinder {
    fn visit(&self, dir: &Path, depth: usize, walk: &mut Walk<'_>) {
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        let entries: Vec<fs::DirEntry> = entries.flatten().collect();
        let names: Vec<String> = entries
            .iter()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        let mut idle: Option<Option<u32>> = None;
        for profile in walk.profiles {
            let marked = profile
                .markers
                .iter()
                .any(|m| names.iter().any(|n| marker_matches(m, n)));
            if !marked {
                continue;
            }
            for artifact in &profile.artifacts {
                let path = dir.join(artifact);
                let is_dir = fs::symlink_metadata(&path)
                    .map(|m| m.is_dir() && !is_link(&m))
                    .unwrap_or(false);
                if !is_dir || !walk.seen.insert(path.clone()) {
                    continue;
                }
                let idle_days = *idle.get_or_insert_with(|| self.idle_days(dir, &walk.artifacts));
                walk.out.push(FoundArtifact {
                    profile: profile.id.clone(),
                    project: dir.to_string_lossy().into_owned(),
                    path: path.to_string_lossy().into_owned(),
                    idle_days,
                });
            }
        }
        if depth >= self.max_depth {
            return;
        }
        let subdirs: Vec<PathBuf> = entries
            .iter()
            .filter_map(|e| walkable(e, &walk.artifacts))
            .collect();
        for sub in subdirs {
            self.visit(&sub, depth + 1, walk);
        }
    }

    fn idle_days(&self, project: &Path, artifacts: &HashSet<&str>) -> Option<u32> {
        let mut newest = newest_file(project, 0, artifacts);
        if let Some(git) = modified(&project.join(".git").join("index")) {
            newest = Some(newest.map_or(git, |n| n.max(git)));
        }
        let age = self.now.duration_since(newest?).unwrap_or_default();
        Some(u32::try_from(age.as_secs() / 86_400).unwrap_or(u32::MAX))
    }
}

/// Dias desde o arquivo mais recente até dois níveis abaixo de `dir`
/// (sem descer em link nem pasta oculta). Usado pela busca de sobras de apps.
pub(crate) fn idle_days_of(dir: &Path, now: SystemTime) -> Option<u32> {
    let newest = newest_file(dir, 0, &HashSet::new())?;
    let age = now.duration_since(newest).unwrap_or_default();
    Some(u32::try_from(age.as_secs() / 86_400).unwrap_or(u32::MAX))
}

fn modified(path: &Path) -> Option<SystemTime> {
    fs::symlink_metadata(path).ok()?.modified().ok()
}

fn newest_file(dir: &Path, depth: usize, artifacts: &HashSet<&str>) -> Option<SystemTime> {
    let mut newest: Option<SystemTime> = None;
    for entry in fs::read_dir(dir).ok()?.flatten() {
        let Ok(meta) = fs::symlink_metadata(entry.path()) else {
            continue;
        };
        let found = if meta.is_file() {
            meta.modified().ok()
        } else if depth < ACTIVITY_DEPTH {
            walkable(&entry, artifacts).and_then(|p| newest_file(&p, depth + 1, artifacts))
        } else {
            None
        };
        if let Some(t) = found {
            newest = Some(newest.map_or(t, |n| n.max(t)));
        }
    }
    newest
}

impl ProjectFinder for FsProjectFinder {
    fn find(&self, roots: &[String], profiles: &[ProjectProfile]) -> Vec<FoundArtifact> {
        let mut walk = Walk {
            profiles,
            artifacts: profiles
                .iter()
                .flat_map(|p| p.artifacts.iter().map(String::as_str))
                .collect(),
            seen: HashSet::new(),
            out: Vec::new(),
        };
        if profiles.is_empty() {
            return walk.out;
        }
        for root in roots {
            self.visit(Path::new(root), 0, &mut walk);
        }
        walk.out
    }
}
