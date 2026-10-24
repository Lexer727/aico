//! Integration tests for the native pseudo-terminal (ConPTY / Unix PTY) bridge.
//!
//! The key behavioural difference from the old piped bridge is that child
//! processes must see a real TTY. Under `Stdio::piped()`,
//! `[Console]::IsOutputRedirected` is `True`; under a PTY it is `False`.

use aico_server::{AppState, HostServer, ServerConfig};
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

type WsWrite = SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>;
type WsRead = SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>;

async fn start_server(base_port: u16) -> (SocketAddr, tokio::task::JoinHandle<()>) {
    let config = ServerConfig {
        base_port,
        max_port_attempts: 10,
        host: "127.0.0.1".to_string(),
    };
    let mut server = HostServer::with_state(config, AppState::default());
    let addr = server.bind().await.expect("Failed to bind server");
    let task = tokio::spawn(async move {
        let _ = server.serve().await;
    });
    (addr, task)
}

async fn open_terminal(addr: SocketAddr, init: serde_json::Value) -> (WsWrite, WsRead) {
    let ws_url = format!("ws://{}/api/v1/terminal/ws", addr);
    let (ws_stream, response) = connect_async(&ws_url).await.expect("Failed to connect");
    assert_eq!(response.status(), 101);
    let (mut write, read) = ws_stream.split();
    write
        .send(Message::Text(init.to_string().into()))
        .await
        .expect("Failed to send init");
    (write, read)
}

async fn send_input(write: &mut WsWrite, data: &str) {
    let msg = serde_json::json!({ "type": "input", "data": data });
    write.send(Message::Text(msg.to_string().into())).await.expect("send input");
}

/// Collect decoded `output` payloads until `marker` appears or the timeout elapses.
async fn read_until(read: &mut WsRead, marker: &str, secs: u64) -> String {
    let mut out = String::new();
    let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(secs));
    tokio::pin!(timeout);
    loop {
        tokio::select! {
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                            if v["type"] == "output" {
                                out.push_str(v["data"].as_str().unwrap_or_default());
                            } else if v["type"] == "error" {
                                out.push_str(&format!("[error] {}", v["message"]));
                            }
                        }
                        if out.contains(marker) { break; }
                    }
                    None | Some(Err(_)) => break,
                    _ => {}
                }
            }
            _ = &mut timeout => break,
        }
    }
    out
}

// @verifies ft-terminal-conpty-bridge::TASK-PTY-004::REQ-001
// @verifies ft-terminal-conpty-bridge::TASK-PTY-004::REQ-002
// @verifies ft-terminal-conpty-bridge::TASK-PTY-006::REQ-003
// @verifies ft-terminal-conpty-bridge::TASK-PTY-004::REQ-004
// @verifies ft-terminal-conpty-bridge::TASK-PTY-006::REQ-007
// @verifies ft-terminal-conpty-bridge::TASK-PTY-002::REQ-009
#[tokio::test]
async fn test_child_process_sees_a_real_tty() {
    let (addr, server) = start_server(5010).await;
    let (mut write, mut read) = open_terminal(
        addr,
        serde_json::json!({ "type": "init", "shell": "powershell", "cwd": ".", "cols": 120, "rows": 30 }),
    )
    .await;

    // The echoed command line contains `"R=" +`, never `R=False`, so the
    // marker can only come from the evaluated expression.
    send_input(&mut write, "Write-Host (\"R=\" + [Console]::IsOutputRedirected)\r").await;
    let out = read_until(&mut read, "R=False", 15).await;

    assert!(
        out.contains("R=False"),
        "Child process should run attached to a PTY (IsOutputRedirected=False). Got: {}",
        out
    );
    server.abort();
}

// @verifies ft-terminal-conpty-bridge::TASK-PTY-004::REQ-005
#[tokio::test]
async fn test_resize_message_updates_pty_geometry() {
    let (addr, server) = start_server(5020).await;
    let (mut write, mut read) = open_terminal(
        addr,
        serde_json::json!({ "type": "init", "shell": "powershell", "cwd": ".", "cols": 80, "rows": 24 }),
    )
    .await;

    send_input(&mut write, "Write-Host (\"W=\" + $Host.UI.RawUI.WindowSize.Width)\r").await;
    let before = read_until(&mut read, "W=80", 15).await;
    assert!(before.contains("W=80"), "Initial PTY width should be 80. Got: {}", before);

    let resize = serde_json::json!({ "type": "resize", "cols": 132, "rows": 40 });
    write.send(Message::Text(resize.to_string().into())).await.expect("send resize");
    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

    send_input(&mut write, "Write-Host (\"W=\" + $Host.UI.RawUI.WindowSize.Width)\r").await;
    let after = read_until(&mut read, "W=132", 15).await;
    assert!(after.contains("W=132"), "PTY width should follow resize to 132. Got: {}", after);

    server.abort();
}

// @verifies ft-terminal-conpty-bridge::TASK-PTY-007::REQ-006
// @verifies ft-terminal-conpty-bridge::TASK-PTY-003::REQ-008
#[tokio::test]
async fn test_session_registry_tracks_state_and_cleans_up() {
    let (addr, server) = start_server(5030).await;
    let (mut write, mut read) = open_terminal(
        addr,
        serde_json::json!({ "type": "init", "shell": "cmd", "cwd": ".", "cols": 100, "rows": 30 }),
    )
    .await;

    send_input(&mut write, "echo SESSION_READY\r").await;
    let out = read_until(&mut read, "SESSION_READY", 15).await;
    assert!(out.contains("SESSION_READY"), "cmd session should echo. Got: {}", out);

    let sessions_url = format!("http://{}/api/v1/terminal/sessions", addr);

    // After the shell has been quiet for a while, it is waiting for input.
    tokio::time::sleep(tokio::time::Duration::from_millis(2500)).await;
    let sessions: serde_json::Value = reqwest::get(&sessions_url).await.unwrap().json().await.unwrap();
    let list = sessions.as_array().expect("sessions should be an array");
    assert_eq!(list.len(), 1, "Exactly one session should be registered: {}", sessions);
    assert_eq!(list[0]["shell"], "cmd");
    assert_eq!(list[0]["is_ai"], false);
    assert_eq!(list[0]["state"], "waiting_for_input", "Idle shell state: {}", sessions);

    // Closing the socket must deregister the session and kill the process.
    let close = serde_json::json!({ "type": "close" });
    let _ = write.send(Message::Text(close.to_string().into())).await;
    drop(write);
    drop(read);

    let mut remaining = usize::MAX;
    for _ in 0..30 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        let s: serde_json::Value = reqwest::get(&sessions_url).await.unwrap().json().await.unwrap();
        remaining = s.as_array().map(|a| a.len()).unwrap_or(usize::MAX);
        if remaining == 0 {
            break;
        }
    }
    assert_eq!(remaining, 0, "Session should be removed after close");

    server.abort();
}

// @verifies ft-terminal-conpty-bridge::TASK-PTY-006::REQ-003
// @verifies ft-terminal-panel-ui::TASK-TERM-002-7::REQ-011
#[tokio::test]
async fn test_default_cwd_resolves_to_workspace_root_parent_of_specs_path() {
    use aico_core::{DiscoveredProject, ProjectManifest, ProjectStatus};

    let temp_root = std::env::temp_dir().join(format!("aico_ws_root_{}", rand::random::<u32>()));
    let specs_dir = temp_root.join("aico-specs");
    let codebase_dir = temp_root.join("codebase").join("aico");
    std::fs::create_dir_all(&specs_dir).expect("create specs_dir");
    std::fs::create_dir_all(&codebase_dir).expect("create codebase_dir");

    let state = AppState::default();
    {
        let mut reg = state.registry.write().await;
        reg.register(DiscoveredProject {
            id: "aico".to_string(),
            name: "aico".to_string(),
            specs_path: specs_dir.clone(),
            codebase_path: Some(codebase_dir),
            manifest: ProjectManifest {
                name: "aico".to_string(),
                id: None,
                version: Some("0.1.1".to_string()),
                codebase_path: Some("../codebase/aico".to_string()),
                created_at: None,
                repositories: Some(Vec::new()),
            },
            status: ProjectStatus::Active,
        });
        reg.set_active("aico");
    }

    let config = ServerConfig {
        base_port: 5040,
        max_port_attempts: 10,
        host: "127.0.0.1".to_string(),
    };
    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Failed to bind server");
    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    // Omit `cwd` in init so the server resolves the default working directory
    let (mut write, mut read) = open_terminal(
        addr,
        serde_json::json!({ "type": "init", "shell": "powershell", "cols": 120, "rows": 30 }),
    )
    .await;

    send_input(&mut write, "Write-Host (\"CWD=\" + (Get-Location).Path)\r").await;
    let expected_marker = format!("CWD={}", temp_root.display());
    let out = read_until(&mut read, &expected_marker, 15).await;

    assert!(
        out.contains(&expected_marker),
        "Default terminal cwd should be the AICO Workspace Root ({}), not specs_dir ({}). Got: {}",
        temp_root.display(),
        specs_dir.display(),
        out
    );

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_root);
}

// @verifies ft-terminal-conpty-bridge::TASK-PTY-006::REQ-010
#[tokio::test]
async fn test_initial_conpty_dsr_query_is_stripped_from_websocket_output() {
    let (addr, server) = start_server(5050).await;
    let (mut write, mut read) = open_terminal(
        addr,
        serde_json::json!({ "type": "init", "shell": "powershell", "cwd": ".", "cols": 120, "rows": 30 }),
    )
    .await;

    // Wait for initial PowerShell prompt
    let initial = read_until(&mut read, "PS ", 15).await;
    assert!(
        !initial.contains("\x1b[6n"),
        "Initial ConPTY DSR query (\\x1b[6n) must be stripped before forwarding to WebSocket client so xterm does not inject a duplicate \\x1b[1;1R into PSReadLine. Got: {:?}",
        initial
    );

    // Send a single first character ('e') followed by 'cho FIRST_KEY_OK\r' to ensure the very first keystroke is not swallowed
    send_input(&mut write, "e").await;
    send_input(&mut write, "cho FIRST_KEY_OK\r").await;
    let out = read_until(&mut read, "FIRST_KEY_OK", 15).await;
    assert!(
        out.contains("FIRST_KEY_OK") && !out.contains("\x07"),
        "First keystroke in PowerShell must register without console bell (\\x07). Got: {:?}",
        out
    );

    server.abort();
}

// @verifies ft-terminal-conpty-bridge::TASK-PTY-007::REQ-006
// @verifies ft-terminal-conpty-bridge::TASK-PTY-007::REQ-011
#[tokio::test]
async fn test_named_tab_session_persists_across_reconnect_and_replays_scrollback() {
    let (addr, server) = start_server(5060).await;
    let init_payload = serde_json::json!({
        "type": "init",
        "tab_id": "term-persist-1",
        "shell": "powershell",
        "cwd": ".",
        "cols": 120,
        "rows": 30
    });

    // 1. Open named session and set shell state + emit output
    let (mut write1, mut read1) = open_terminal(addr, init_payload.clone()).await;
    send_input(&mut write1, "$persist_var = 'LIVE_STATE_777'; Write-Host 'SCROLLBACK_HISTORY_ABC'\r").await;
    let out1 = read_until(&mut read1, "SCROLLBACK_HISTORY_ABC", 15).await;
    assert!(out1.contains("SCROLLBACK_HISTORY_ABC"), "Initial output should appear. Got: {}", out1);

    // 2. Simulate F5 browser reload by dropping the WebSocket without sending `close` or `kill`
    drop(write1);
    drop(read1);
    tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;

    // 3. Reconnect with the same `tab_id`
    let (mut write2, mut read2) = open_terminal(addr, init_payload).await;

    // 4. Buffered scrollback must be replayed automatically on re-attach
    let replayed = read_until(&mut read2, "SCROLLBACK_HISTORY_ABC", 10).await;
    assert!(
        replayed.contains("SCROLLBACK_HISTORY_ABC"),
        "Reconnecting with same tab_id must replay scrollback buffer. Got: {}",
        replayed
    );

    // 5. Process state ($persist_var) must still be alive in the re-attached PowerShell session
    send_input(&mut write2, "Write-Host (\"STATE=\" + $persist_var)\r").await;
    let state_out = read_until(&mut read2, "STATE=LIVE_STATE_777", 10).await;
    assert!(
        state_out.contains("STATE=LIVE_STATE_777"),
        "Re-attached session must preserve live shell process state. Got: {}",
        state_out
    );

    // 6. Explicit `close` message must terminate and unregister the named session
    let close = serde_json::json!({ "type": "close" });
    let _ = write2.send(Message::Text(close.to_string().into())).await;
    drop(write2);
    drop(read2);

    let sessions_url = format!("http://{}/api/v1/terminal/sessions", addr);
    let mut remaining = usize::MAX;
    for _ in 0..30 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        let s: serde_json::Value = reqwest::get(&sessions_url).await.unwrap().json().await.unwrap();
        remaining = s.as_array().map(|a| a.len()).unwrap_or(usize::MAX);
        if remaining == 0 {
            break;
        }
    }
    assert_eq!(remaining, 0, "Named session should be terminated and removed after explicit close");

    server.abort();
}

#[tokio::test]
// @verifies ft-terminal-conpty-bridge::TASK-PTY-008::REQ-012
async fn test_named_tab_session_supports_concurrent_clients_with_fanout() {
    let (addr, server) = start_server(5080).await;
    let init_payload = serde_json::json!({
        "type": "init",
        "tab_id": "tab-fanout-concurrent",
        "shell": "powershell",
        "cwd": ".",
        "cols": 80,
        "rows": 24
    });

    // 1. Client 1 (e.g. Desktop PC) connects with tab_id
    let (mut write1, mut read1) = open_terminal(addr, init_payload.clone()).await;

    // 2. Client 2 (e.g. Mobile Companion) connects to the same tab_id concurrently
    let (write2, mut read2) = open_terminal(addr, init_payload).await;

    // 3. Client 1 sends command
    send_input(&mut write1, "Write-Host 'FANOUT_OK'\r").await;

    // 4. Assert both Client 1 and Client 2 receive the echoed output
    let out1 = read_until(&mut read1, "FANOUT_OK", 15).await;
    let out2 = read_until(&mut read2, "FANOUT_OK", 15).await;

    assert!(out1.contains("FANOUT_OK"), "Client 1 should receive output from shared PTY. Got: {}", out1);
    assert!(out2.contains("FANOUT_OK"), "Client 2 (companion) should receive fanout output from shared PTY concurrently. Got: {}", out2);

    // Clean up
    let close = serde_json::json!({ "type": "close" });
    let _ = write1.send(Message::Text(close.to_string().into())).await;
    drop(write1);
    drop(read1);
    drop(write2);
    drop(read2);

    server.abort();
}



