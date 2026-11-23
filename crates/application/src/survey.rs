use disk_cleanup_domain::{AggregateEntry, ByteSize, FocusRoot, SizeAggregator, VolumeUsage};

use crate::{AppError, FileWalker, ScanProgress, VolumeInfo};

const PROGRESS_EVERY: u64 = 10_000;
const ROOTS: &str = "roots";
const CHILDREN: &str = "children";
const PROFILE: &str = "profile";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SurveyRequest {
    /// Raiz do volume, ex.: `C:\` ou `/`.
    pub volume_root: String,
    /// Perfil do usuário a detalhar (onde vive a maior parte do lixo).
    pub profile: Option<String>,
    /// 1 = só raízes; 2 = raízes + filhos.
    pub depth: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SurveyReport {
    pub volume: VolumeUsage,
    pub roots: Vec<AggregateEntry>,
    pub children: Vec<AggregateEntry>,
    pub profile: Vec<AggregateEntry>,
    /// Pastas de nuvem do perfil (lógico × alocado).
    pub cloud: Vec<AggregateEntry>,
    pub files: u64,
    pub unreadable: u64,
    /// Usado no volume e não atribuído a nenhum arquivo visitado
    /// (metadados, arquivos sem permissão, sistema).
    pub unattributed: ByteSize,
}

/// Levantamento somente leitura: uma única varredura alimenta todas as visões.
pub struct SurveyService<'a> {
    walker: &'a dyn FileWalker,
    volumes: &'a dyn VolumeInfo,
    progress: &'a dyn ScanProgress,
}

impl<'a> SurveyService<'a> {
    pub fn new(
        walker: &'a dyn FileWalker,
        volumes: &'a dyn VolumeInfo,
        progress: &'a dyn ScanProgress,
    ) -> Self {
        Self {
            walker,
            volumes,
            progress,
        }
    }

    pub fn run(&self, request: &SurveyRequest) -> Result<SurveyReport, AppError> {
        if !(1..=2).contains(&request.depth) {
            return Err(AppError::InvalidRequest(format!(
                "profundidade deve ser 1 ou 2 (recebido {})",
                request.depth
            )));
        }
        let volume = self.volumes.usage(&request.volume_root)?;
        let mut aggregator = SizeAggregator::new(Self::focuses(request));

        let mut count = 0u64;
        let mut logical = ByteSize::ZERO;
        let stats = self.walker.walk(&request.volume_root, &mut |file| {
            aggregator.add_file(&file.components, file.logical, file.allocated);
            count += 1;
            logical += file.logical;
            if count.is_multiple_of(PROGRESS_EVERY) {
                self.progress.scanned(count, logical);
            }
        })?;
        if !count.is_multiple_of(PROGRESS_EVERY) {
            self.progress.scanned(count, logical);
        }

        let roots = aggregator.entries(ROOTS);
        let children = aggregator
            .entries(CHILDREN)
            .into_iter()
            .filter(|e| e.key.len() == 2)
            .collect();
        let profile = aggregator.entries(PROFILE);
        let cloud = profile.iter().filter(|e| e.is_cloud()).cloned().collect();
        let attributed: ByteSize = roots.iter().map(|e| e.allocated).sum();

        Ok(SurveyReport {
            unattributed: volume.used().saturating_sub(attributed),
            volume,
            roots,
            children,
            profile,
            cloud,
            files: stats.files,
            unreadable: stats.unreadable,
        })
    }

    fn focuses(request: &SurveyRequest) -> Vec<FocusRoot> {
        let mut focuses = vec![FocusRoot::new(ROOTS, &request.volume_root, 1)];
        if request.depth == 2 {
            focuses.push(FocusRoot::new(CHILDREN, &request.volume_root, 2));
        }
        if let Some(profile) = &request.profile {
            focuses.push(FocusRoot::new(PROFILE, profile, 1));
        }
        focuses
    }
}

impl std::fmt::Debug for SurveyService<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SurveyService")
    }
}
