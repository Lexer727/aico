use aico_core::scanner::RootScanner;
use aico_core::SkillsSynchronizer;
use aico_server::{AppState, HostServer, ServerConfig};
use std::env;
use std::path::{Path, PathBuf};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    println!("============================================================");
    println!("   AICO - Autonomous Intelligent Code Orchestrator");
    println!("   Version: 0.1.1 (Spec-Driven Development Platform)");
    println!("============================================================");

    // 2. Determine root directory for project scanning
    let root_dir = env::var("AICO_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            if Path::new("d:/aico").exists() {
                PathBuf::from("d:/aico")
            } else if Path::new("../..").exists() {
                PathBuf::from("../..")
            } else {
                env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
            }
        });

    println!("[*] Workspace root: {}", root_dir.display());

    // 2b. Synchronize workspace .agents/skills, .agents/rules, and GEMINI.md from codebase/aico/skills
    // @implements ft-core-skills-sync::TASK-SYNC-002::REQ-002
    // @implements ft-core-skills-sync::TASK-SYNC-003::REQ-005
    // @implements ft-core-skills-sync::TASK-SYNC-003::REQ-007
    match SkillsSynchronizer::sync_workspace(&root_dir) {
        Ok(report) if report.skills_synced > 0 => {
            println!(
                "[*] Workspace skills & rules synced ({} skills, {} files updated, {} stale entries pruned)",
                report.skills_synced, report.files_updated, report.entries_removed
            );
        }
        Ok(_) => {
            tracing::warn!(
                "Skills submodule not found or empty under {}/codebase/aico/skills; skipping workspace sync",
                root_dir.display()
            );
        }
        Err(e) => {
            tracing::warn!("Failed to synchronize workspace skills and rules: {}", e);
        }
    }

    let state = AppState::default();

    // 3. Scan for project workspaces
    match RootScanner::scan(&root_dir) {
        Ok(projects) => {
            let mut reg = state.registry.write().await;
            for p in &projects {
                println!("  -> Discovered project: {} ({})", p.name, p.specs_path.display());
                reg.register(p.clone());
            }
            if !projects.is_empty() {
                reg.set_active(&projects[0].id);
                println!("[*] Active project set to: {}", projects[0].id);
                drop(reg);
                for p in &projects {
                    let _ = state.storage_federation.register_project(&p.id, &p.specs_path).await;
                }
                if let Ok(sm) = state.storage_federation.register_project(&projects[0].id, &projects[0].specs_path).await {
                    let _ = state.storage_federation.switch_project(&projects[0].id).await;
                    let mut st = state.storage.write().await;
                    *st = Some((*sm).clone());
                    println!("[*] Storage initialized for active project ({})", projects[0].id);
                }

                // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-3::REQ-004
                let crawler_state = state.clone();
                let active_specs = projects[0].specs_path.clone();
                let active_codebase = projects[0].codebase_path.clone();
                let active_id = projects[0].id.clone();
                tokio::spawn(async move {
                    if let Ok(storage) = crawler_state.storage_federation.register_project(&active_id, &active_specs).await {
                        println!("[*] Starting background workspace vector indexing for ({})", active_id);
                        match aico_server::crawler::WorkspaceCrawler::crawl_and_index(&storage, &active_specs, active_codebase.as_deref()).await {
                            Ok(report) => {
                                println!("[*] Background vector indexing complete: {} files, {} chunks indexed", report.files_scanned, report.chunks_upserted);
                                crawler_state.ws_hub.broadcast("storage_updated", &active_id);
                            }
                            Err(e) => {
                                eprintln!("[!] Background vector indexing note: {}", e);
                            }
                        }
                    }
                });
            }
        }
        Err(e) => {
            println!("[*] Discovery note: {}", e);
        }
    }

    // 4. Configure & bind host server
    let config = ServerConfig {
        base_port: 4242,
        max_port_attempts: 10,
        host: "0.0.0.0".to_string(),
    };

    let mut server = HostServer::with_state(config, state.clone());
    let addr = server.bind().await?;

    let pairing_url = state.auth.pairing_url("localhost", addr.port());

    println!("------------------------------------------------------------");
    println!("* Local WebUI:     http://localhost:{}/", addr.port());
    println!("* Network Pairing: {}", pairing_url);
    println!("* WebSocket Hub:   ws://localhost:{}/ws", addr.port());
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-013
    println!("* MCP Endpoint:    http://localhost:{}/mcp", addr.port());
    println!("------------------------------------------------------------");
    println!("Press Ctrl+C to stop the server.");
    println!("============================================================");

    // 5. Serve with graceful shutdown
    server
        .serve_with_shutdown(async {
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to listen for Ctrl+C");
        })
        .await?;

    println!("[*] AICO server drained and stopped cleanly.");
    Ok(())
}
