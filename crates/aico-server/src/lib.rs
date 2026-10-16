pub mod server;
pub mod ws;
pub mod auth;
pub mod assets;
pub mod git;
pub mod terminal;
pub mod quotas;

pub use server::{
    AppState, DiscoveredEpic, DiscoveredSpecInfo, HealthResponse, HostServer, ServerConfig,
    SetActiveProjectRequest, SystemStats,
};
pub use ws::{WebSocketHub, HubMessage};
pub use auth::LanAuthenticator;
pub use assets::{FrontendAssets, static_asset_handler};
pub use git::{GitRepoStatus, GitStatusScanner, GitCommitInfo};
pub use terminal::{terminal_ws_handler, resolve_shell_command, ShellType};
