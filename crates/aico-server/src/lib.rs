pub mod server;
pub mod ws;
pub mod auth;
pub mod assets;
pub mod git;
pub mod terminal;
pub mod quotas;
pub mod crawler;
pub mod github_service;

pub use server::{
    AppState, CodeAnnotationInfo, CodeFileInfo, DiscoveredEpic, DiscoveredSpecInfo, HealthResponse,
    HostServer, ServerConfig, SetActiveProjectRequest, SystemStats, scan_codebase_files,
    resolve_workspace_root_from_specs_path, GraphCacheManager,
};
pub use ws::{WebSocketHub, HubMessage};
pub use auth::LanAuthenticator;
pub use assets::{FrontendAssets, static_asset_handler};
pub use git::{GitRepoStatus, GitStatusScanner, GitCommitInfo};
pub use terminal::{terminal_ws_handler, resolve_shell_command, ShellType};
pub use crawler::{WorkspaceCrawler, CrawlReport};
