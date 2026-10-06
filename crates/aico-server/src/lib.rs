pub mod server;
pub mod ws;
pub mod auth;
pub mod assets;

pub use server::{
    AppState, DiscoveredEpic, DiscoveredSpecInfo, HealthResponse, HostServer, ServerConfig,
    SetActiveProjectRequest, SystemStats,
};
pub use ws::{WebSocketHub, HubMessage};
pub use auth::LanAuthenticator;
pub use assets::{FrontendAssets, static_asset_handler};
