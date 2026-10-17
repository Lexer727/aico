use aico_server::{AppState, HostServer, ServerConfig};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

// @verifies ft-terminal-backend-stream-bridge::TASK-TERM-001-3::REQ-001
// @verifies ft-terminal-backend-stream-bridge::TASK-TERM-001-1::REQ-002
// @verifies ft-terminal-backend-stream-bridge::TASK-TERM-001-2::REQ-003
// @verifies ft-terminal-backend-stream-bridge::TASK-TERM-001-2::REQ-004
// @verifies ft-terminal-backend-stream-bridge::TASK-TERM-001-2::REQ-005
#[tokio::test]
async fn test_terminal_websocket_spawn_shell_and_loopback() {
    let config = ServerConfig {
        base_port: 4950,
        max_port_attempts: 10,
        host: "127.0.0.1".to_string(),
    };
    let state = AppState::default();
    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Failed to bind server");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let ws_url = format!("ws://{}/api/v1/terminal/ws", addr);
    let (ws_stream, response) = connect_async(&ws_url)
        .await
        .expect("Failed to connect to /api/v1/terminal/ws");

    assert_eq!(response.status(), 101);

    let (mut write, mut read) = ws_stream.split();

    // 1. Send init for cmd
    let init_msg = serde_json::json!({
        "type": "init",
        "shell": "cmd",
        "cwd": "."
    });
    write.send(Message::Text(init_msg.to_string().into())).await.expect("Failed to send init");

    // 2. Send input command
    let input_msg = serde_json::json!({
        "type": "input",
        "data": "echo AICO_TERMINAL_ONLINE\r\n"
    });
    write.send(Message::Text(input_msg.to_string().into())).await.expect("Failed to send input");

    // 3. Read output from shell process
    let mut received_output = String::new();
    let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(5));
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            msg = read.next() => {
                if let Some(Ok(Message::Text(text))) = msg {
                    received_output.push_str(&text);
                    if received_output.contains("AICO_TERMINAL_ONLINE") {
                        break;
                    }
                }
            }
            _ = &mut timeout => {
                break;
            }
        }
    }

    assert!(
        received_output.contains("AICO_TERMINAL_ONLINE"),
        "Expected output to contain AICO_TERMINAL_ONLINE, got: {}",
        received_output
    );

    // 4. Send close
    let close_msg = serde_json::json!({ "type": "close" });
    let _ = write.send(Message::Text(close_msg.to_string().into())).await;

    server_task.abort();
}

// @verifies ft-terminal-backend-stream-bridge::TASK-TERM-001-1::REQ-006
// @verifies ft-terminal-backend-stream-bridge::TASK-TERM-001-3::REQ-007
#[tokio::test]
async fn test_terminal_websocket_shell_resolution_and_error_handling() {
    let config = ServerConfig {
        base_port: 4960,
        max_port_attempts: 10,
        host: "127.0.0.1".to_string(),
    };
    let state = AppState::default();
    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Failed to bind server");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let ws_url = format!("ws://{}/api/v1/terminal/ws", addr);
    let (ws_stream, response) = connect_async(&ws_url)
        .await
        .expect("Failed to connect to /api/v1/terminal/ws");

    assert_eq!(response.status(), 101);

    let (mut write, mut read) = ws_stream.split();

    // Send init with non-existent shell
    let init_msg = serde_json::json!({
        "type": "init",
        "shell": "non_existent_shell_xyz",
        "cwd": "."
    });
    write.send(Message::Text(init_msg.to_string().into())).await.expect("Failed to send init");

    // Server should send an error message, not crash
    let mut got_error = false;
    let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(3));
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            msg = read.next() => {
                if let Some(Ok(Message::Text(text))) = msg {
                    if text.contains("error") || text.contains("Unknown shell") || text.contains("failed") {
                        got_error = true;
                        break;
                    }
                }
            }
            _ = &mut timeout => {
                break;
            }
        }
    }

    assert!(got_error, "Server should return an error message for unknown shell");

    server_task.abort();
}

// @verifies ft-terminal-backend-stream-bridge::TASK-TERM-001-4::REQ-008
#[tokio::test]
async fn test_terminal_powershell_clear_command_execution() {
    let config = ServerConfig {
        base_port: 4970,
        max_port_attempts: 10,
        host: "127.0.0.1".to_string(),
    };
    let state = AppState::default();
    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Failed to bind server");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let ws_url = format!("ws://{}/api/v1/terminal/ws", addr);
    let (ws_stream, response) = connect_async(&ws_url)
        .await
        .expect("Failed to connect to /api/v1/terminal/ws");

    assert_eq!(response.status(), 101);

    let (mut write, mut read) = ws_stream.split();

    // 1. Send init for cmd
    let init_msg = serde_json::json!({
        "type": "init",
        "shell": "cmd",
        "cwd": "."
    });
    write.send(Message::Text(init_msg.to_string().into())).await.expect("Failed to send init");

    // 2. Send cls command followed by echo to ensure detached execution is clean
    let input_msg = serde_json::json!({
        "type": "input",
        "data": "cls\r\necho ISOLATION_VERIFIED\r\n"
    });
    write.send(Message::Text(input_msg.to_string().into())).await.expect("Failed to send input");

    let mut received_output = String::new();
    let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(5));
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            msg = read.next() => {
                if let Some(Ok(Message::Text(text))) = msg {
                    received_output.push_str(&text);
                    if received_output.contains("ISOLATION_VERIFIED") {
                        break;
                    }
                }
            }
            _ = &mut timeout => {
                break;
            }
        }
    }

    assert!(
        received_output.contains("ISOLATION_VERIFIED"),
        "Expected output to contain ISOLATION_VERIFIED, got: {}",
        received_output
    );

    let close_msg = serde_json::json!({ "type": "close" });
    let _ = write.send(Message::Text(close_msg.to_string().into())).await;

    server_task.abort();
}

// @verifies ft-terminal-panel-ui::TASK-TERM-002-18::REQ-022
#[tokio::test]
async fn test_terminal_kill_message_terminates_session() {
    let config = ServerConfig {
        base_port: 4980,
        max_port_attempts: 10,
        host: "127.0.0.1".to_string(),
    };
    let state = AppState::default();
    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Failed to bind server");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let ws_url = format!("ws://{}/api/v1/terminal/ws", addr);
    let (ws_stream, _) = connect_async(&ws_url)
        .await
        .expect("Failed to connect to /api/v1/terminal/ws");

    let (mut write, mut read) = ws_stream.split();

    // Init PowerShell
    let init_msg = serde_json::json!({
        "type": "init",
        "shell": "powershell",
        "cwd": "."
    });
    write.send(Message::Text(init_msg.to_string().into())).await.expect("Failed to send init");

    // Wait briefly for process to start
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Send forceful kill message
    let kill_msg = serde_json::json!({ "type": "kill" });
    write.send(Message::Text(kill_msg.to_string().into())).await.expect("Failed to send kill");

    // WebSocket stream should terminate/close
    let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(3));
    tokio::pin!(timeout);

    let mut stream_closed = false;
    loop {
        tokio::select! {
            msg = read.next() => {
                match msg {
                    None | Some(Ok(Message::Close(_))) | Some(Err(_)) => {
                        stream_closed = true;
                        break;
                    }
                    _ => {}
                }
            }
            _ = &mut timeout => {
                break;
            }
        }
    }

    assert!(stream_closed, "WebSocket connection should close upon Kill message");
    server_task.abort();
}

