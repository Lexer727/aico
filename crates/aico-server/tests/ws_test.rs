use aico_server::{WebSocketHub, HubMessage};

// @verifies SPEC-CORE-001::REQ-003
// @verifies SPEC-CORE-001::REQ-007
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
