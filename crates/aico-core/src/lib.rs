pub mod manifest;
pub mod scanner;
pub mod registry;
pub mod wizard;
pub mod watcher;
pub mod human_gate;
pub mod config;
pub mod skills_sync;
pub mod github;
pub mod root;

pub use manifest::{ProjectManifest, ProjectRepository, ManifestError};
pub use scanner::{RootScanner, DiscoveredProject, ProjectStatus};
pub use registry::WorkspaceRegistry;
pub use wizard::CodebaseWizard;
pub use watcher::{DiscoveryWatcher, DiscoveryEvent};
pub use human_gate::{
    HumanGateManager, HumanGateError, PlanTask, TaskRole, TaskStatus,
    FrontierTransition, TaskUnblockedEvent,
};
pub use config::{AicoConfig, AssetsConfig};
pub use skills_sync::{SkillsSynchronizer, SyncReport, SkillsSyncError};
pub use github::{find_gh_binary, GitHubConfig, GitHubCredentialManager, ResolvedGitHubToken, TokenSource};

