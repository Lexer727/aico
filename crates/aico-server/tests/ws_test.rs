use aico_server::{WebSocketHub, HubMessage};

// @verifies ft-core-host-runtime::TASK-CORE-001-6::REQ-003
// @verifies ft-core-host-runtime::TASK-CORE-001-6::REQ-007
#[tokio::test]
async fn test_websocket_connect_and_broadcast() {
    let hub = WebSocketHub::new(16);
    let mut rx = hub.subscribe();

    let subscribers = hub.broadcast("audit_event", r#"{"command": "cargo test"}"#);
    assert_eq!(subscribers, 1, "Should deliver broadcast to the active subscriber");

    let received: HubMessage = rx.recv().await.expect("Subscriber should receive message");
    assert_eq!(received.topic, "audit_event");
    assert!(received.payload.contains("cargo test"));
}

// @verifies ft-core-host-runtime::TASK-CORE-001-6::REQ-003
// @verifies ft-core-host-runtime::TASK-CORE-001-6::REQ-007
#[tokio::test]
async fn test_real_websocket_handshake_and_stream() {
    use aico_server::{AppState, HostServer, ServerConfig};
    use futures_util::StreamExt;
    use tokio_tungstenite::connect_async;
    use tokio_tungstenite::tungstenite::Message;

    let config = ServerConfig {
        base_port: 4890,
        max_port_attempts: 10,
        host: "127.0.0.1".to_string(),
    };
    let state = AppState::default();
    let ws_hub = state.ws_hub.clone();

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Failed to bind server");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let ws_url = format!("ws://{}/ws", addr);
    let (ws_stream, response) = connect_async(&ws_url)
        .await
        .expect("Failed to connect WebSocket to /ws");

    assert_eq!(response.status(), 101, "Expected 101 Switching Protocols");

    let (_write, mut read) = ws_stream.split();

    // Broadcast an event through the hub
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    ws_hub.broadcast("spec_update", r#"{"spec_id": "spec-ft-core-host-runtime"}"#);

    // Assert message received over real WS
    if let Some(Ok(Message::Text(text))) = read.next().await {
        assert!(text.contains("spec_update"), "Expected spec_update topic in: {}", text);
        assert!(text.contains("spec-ft-core-host-runtime"), "Expected spec-ft-core-host-runtime payload in: {}", text);
    } else {
        panic!("Did not receive broadcast text message over WebSocket");
    }

    server_task.abort();
}
