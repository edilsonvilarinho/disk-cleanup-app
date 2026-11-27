//! Infraestrutura: implementações concretas das portas da aplicação.

mod allocated;
mod catalog;
mod env;
mod exclusions;
mod hasher;
mod inspector;
mod plan_json;
mod progress;
mod projects;
mod runner;
mod volume;
mod walker;

pub use allocated::allocated_size;
pub use catalog::{catalog_for, TomlCatalogRepository};
pub use env::SnapshotEnvironment;
pub use exclusions::exclusions_for;
pub use hasher::StdContentHasher;
pub use inspector::WalkerPathInspector;
pub use plan_json::SkillPlanJsonCodec;
pub use progress::SilentProgress;
pub use projects::FsProjectFinder;
pub use runner::{FsActionRunner, Recycler, SystemRecycler};
pub use volume::SysinfoVolumeInfo;
pub use walker::JwalkFileWalker;
