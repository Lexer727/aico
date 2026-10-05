use aico_server::{HostServer, ServerConfig};
use tokio::sync::oneshot;

// @verifies SPEC-CORE-001::REQ-005
#[tokio::test]
async fn test_server_graceful_shutdown_broadcasts_and_drains() {
    let mut config = ServerConfig::default();
    config.base_port = 4252;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind");

    let hub = server.state().ws_hub.clone();
    let mut rx = hub.subscribe();

    let (shutdown_tx, shutdown_rx) = oneshot::channel();

    let server_handle = tokio::spawn(async move {
        server.serve_with_shutdown(async move {
            let _ = shutdown_rx.await;
        }).await
    });

    // Verify server is alive
    let client = reqwest::Client::new();
    let health = client.get(format!("http://{}/api/v1/health", addr)).send().await;
    assert!(health.is_ok());

    // Trigger graceful shutdown
    let _ = shutdown_tx.send(());

    // Verify shutdown event received on WebSocket hub
    let msg = rx.recv().await.expect("Shutdown event must be broadcast to subscribers");
    assert_eq!(msg.topic, "server_shutdown");

    // Wait for server to terminate cleanly
    let result = server_handle.await.expect("JoinHandle should resolve");
    assert!(result.is_ok(), "Server should terminate with Ok(())");
}
