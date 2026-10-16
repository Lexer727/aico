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
    // @implements spec-ft-core-skills-sync::REQ-002
    // @implements spec-ft-core-skills-sync::REQ-005
    // @implements spec-ft-core-skills-sync::REQ-007
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
