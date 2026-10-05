use aico_server::{HostServer, ServerConfig, HealthResponse};

// @verifies SPEC-CORE-001::REQ-001
#[tokio::test]
async fn test_server_binds_to_available_port() {
    let mut config = ServerConfig::default();
    config.base_port = 4242;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully to port 4242 or fallback");

    assert!(addr.port() >= 4242 && addr.port() <= 4252, "Port should be within 4242..4252 range");
    assert_eq!(server.bound_addr(), Some(addr));
}

// @verifies SPEC-CORE-001::REQ-006
#[tokio::test]
async fn test_health_check_endpoint() {
    let mut config = ServerConfig::default();
    config.base_port = 4244;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully");

    // Spawn server background task
    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();
    let url = format!("http://{}/api/v1/health", addr);

    let res = client.get(&url).send().await.expect("Health request should succeed");
    assert_eq!(res.status(), 200);

    let health: HealthResponse = res.json().await.expect("Health response should parse as JSON");
    assert_eq!(health.status, "ok");

    server_task.abort();
}
