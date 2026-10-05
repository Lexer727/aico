pub mod manifest;
pub mod scanner;
pub mod registry;
pub mod wizard;
pub mod watcher;

pub use manifest::{ProjectManifest, ManifestError};
pub use scanner::{RootScanner, DiscoveredProject, ProjectStatus};
pub use registry::WorkspaceRegistry;
pub use wizard::CodebaseWizard;
pub use watcher::{DiscoveryWatcher, DiscoveryEvent};


