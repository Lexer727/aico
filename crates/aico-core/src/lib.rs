pub mod manifest;
pub mod scanner;
pub mod registry;
pub mod wizard;
pub mod watcher;
pub mod human_gate;

pub use manifest::{ProjectManifest, ProjectRepository, ManifestError};
pub use scanner::{RootScanner, DiscoveredProject, ProjectStatus};
pub use registry::WorkspaceRegistry;
pub use wizard::CodebaseWizard;
pub use watcher::{DiscoveryWatcher, DiscoveryEvent};
pub use human_gate::{
    HumanGateManager, HumanGateError, PlanTask, TaskRole, TaskStatus,
    FrontierTransition, TaskUnblockedEvent,
};
