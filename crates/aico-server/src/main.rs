use aico_core::scanner::RootScanner;
use aico_core::SkillsSynchronizer;
use aico_server::{AppState, HostServer, ServerConfig};
use std::env;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();

    // 0. Handle --version flag immediately
    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-006
    if args.iter().any(|arg| arg == "--version" || arg == "-V") {
        println!("aico-server {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }

    // Parse --root argument if present
    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-001
    let mut cli_root = None;
    let mut i = 1;
    while i < args.len() {
        if args[i] == "--root" && i + 1 < args.len() {
            cli_root = Some(PathBuf::from(&args[i + 1]));
            i += 2;
        } else {
            i += 1;
        }
    }

    // 1. Determine root directory for project scanning
    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-001
    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-008
    let env_root = env::var("AICO_ROOT").ok().map(PathBuf::from);
    let current_exe = env::current_exe().unwrap_or_else(|_| PathBuf::from("aico-server.exe"));
    let current_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    let root_dir = match aico_core::root::resolve_aico_root(
        cli_root.as_deref(),
        env_root.as_deref(),
        &current_exe,
        &current_dir,
    ) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[!] Error resolving AICO workspace root: {}", e);
            std::process::exit(1);
        }
    };

    let _ = aico_core::root::set_aico_root(&root_dir);

    // 2. Initialize dual logging (stdout + file in <root>/.aico/logs/aico-server.log)
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-015
    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-4::REQ-007
    use tracing_subscriber::layer::SubscriberExt;
    use tracing_subscriber::util::SubscriberInitExt;

    let logs_dir = aico_core::root::logs_dir(&root_dir);
    let file_appender = tracing_appender::rolling::never(&logs_dir, "aico-server.log");
    let (file_writer, _log_guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,lance=warn,lancedb=warn"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::fmt::layer().with_writer(file_writer).with_ansi(false))
        .init();

    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-005
    println!("============================================================");
    println!("   AICO - Autonomous Intelligent Code Orchestrator");
    println!("   Version: {} (Spec-Driven Development Platform)", env!("CARGO_PKG_VERSION"));
    println!("============================================================");

    println!("[*] Workspace root: {}", root_dir.display());

    // 2b. Synchronize workspace .agents/skills, .agents/rules, and GEMINI.md from codebase/aico/skills or bundled skills
    // @implements ft-core-skills-sync::TASK-SYNC-002::REQ-002
    // @implements ft-core-skills-sync::TASK-SYNC-003::REQ-005
    // @implements ft-core-skills-sync::TASK-SYNC-003::REQ-007
    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-2::REQ-003
    let exe_dir = current_exe.parent().unwrap_or(&root_dir);
    match SkillsSynchronizer::sync_workspace_with_exe(&root_dir, exe_dir) {
        Ok(report) if report.skills_synced > 0 => {
            println!(
                "[*] Workspace skills & rules synced ({} skills, {} files updated, {} stale entries pruned)",
                report.skills_synced, report.files_updated, report.entries_removed
            );
        }
        Ok(_) => {
            tracing::warn!(
                "Skills source not found or empty under {} or {}; skipping workspace sync",
                root_dir.join("codebase/aico/skills").display(),
                exe_dir.join("skills").display()
            );
        }
        Err(e) => {
            tracing::warn!("Failed to synchronize workspace skills and rules: {}", e);
        }
    }

    // @implements spec-ft-core-canonical-workspace-storage-root::TASK-CORE-023-3::REQ-004
    let state = AppState {
        storage_federation: std::sync::Arc::new(aico_storage::StorageFederationManager::with_workspace_root(&root_dir)),
        ..Default::default()
    };

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
                // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-004
                // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-013
                let crawler_state = state.clone();
                let active_specs = projects[0].specs_path.clone();
                let active_codebase = projects[0].codebase_path.clone();
                let active_id = projects[0].id.clone();
                tokio::spawn(async move {
                    if let Ok(storage) = crawler_state.storage_federation.register_project(&active_id, &active_specs).await {
                        println!("[*] Starting background workspace vector indexing for ({})", active_id);
                        match aico_server::crawler::WorkspaceCrawler::crawl_and_index_incremental(&storage, &active_specs, active_codebase.as_deref()).await {
                            Ok(report) => {
                                println!(
                                    "[*] Background vector indexing complete: {} files scanned, {} chunks updated ({} total chunks)",
                                    report.files_scanned, report.chunks_upserted, report.total_chunks
                                );
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
    // @implements spec-ft-core-auto-open-browser-on-start::TASK-CORE-024-2::REQ-003
    let mut auto_open = true;
    for arg in env::args() {
        if arg == "--no-open" || arg == "--no-browser" {
            auto_open = false;
            break;
        }
    }
    if let Ok(val) = env::var("AICO_NO_BROWSER") {
        if val == "1" || val.eq_ignore_ascii_case("true") {
            auto_open = false;
        }
    }
    if let Ok(val) = env::var("AICO_AUTO_OPEN") {
        if val == "0" || val.eq_ignore_ascii_case("false") {
            auto_open = false;
        }
    }

    let config = ServerConfig {
        base_port: 4242,
        max_port_attempts: 10,
        host: "0.0.0.0".to_string(),
        auto_open_browser: auto_open,
    };

    let mut server = HostServer::with_state(config.clone(), state.clone());
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

    // @implements spec-ft-core-auto-open-browser-on-start::TASK-CORE-024-3::REQ-004
    // @implements spec-ft-core-auto-open-browser-on-start::TASK-CORE-024-3::REQ-005
    if config.auto_open_browser {
        let webui_url = format!("http://localhost:{}/", addr.port());
        tokio::task::spawn_blocking(move || {
            if let Err(e) = aico_server::open_browser(&webui_url) {
                tracing::warn!("Failed to auto-open default browser for {}: {}", webui_url, e);
            }
        });
    }

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
