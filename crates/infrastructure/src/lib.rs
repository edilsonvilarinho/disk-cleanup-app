//! Infraestrutura: implementações concretas das portas da aplicação.

mod allocated;
mod catalog;
mod env;
mod exclusions;
mod inspector;
mod plan_json;
mod progress;
mod volume;
mod walker;

pub use allocated::allocated_size;
pub use catalog::TomlCatalogRepository;
pub use env::SnapshotEnvironment;
pub use exclusions::platform_exclusions;
pub use inspector::WalkerPathInspector;
pub use plan_json::SkillPlanJsonCodec;
pub use progress::SilentProgress;
pub use volume::SysinfoVolumeInfo;
pub use walker::JwalkFileWalker;
