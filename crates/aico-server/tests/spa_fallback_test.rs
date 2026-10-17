use aico_server::{HostServer, ServerConfig};

// @verifies ft-core-host-runtime::TASK-CORE-001-2::REQ-002
#[tokio::test]
async fn test_embedded_spa_fallback() {
    let mut config = ServerConfig::default();
    config.base_port = 4255;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();

    // 1. Root route GET / returns index.html
    let res_root = client
        .get(format!("http://{}/", addr))
        .send()
        .await
        .expect("Root request should succeed");
    assert_eq!(res_root.status(), 200);
    let content_type = res_root
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .expect("Content-Type header must be present")
        .to_str()
        .unwrap();
    assert!(content_type.contains("text/html"), "Root must return text/html");
    let body_root = res_root.text().await.unwrap();
    assert!(body_root.contains("<html") || body_root.contains("<!doctype html>") || body_root.contains("<!DOCTYPE html>"), "Root body must be HTML");

    // 2. Client-side route GET /projects/001/tasks falls back to index.html (SPA Fallback)
    let res_spa = client
        .get(format!("http://{}/projects/001/tasks", addr))
        .send()
        .await
        .expect("SPA route request should succeed");
    assert_eq!(res_spa.status(), 200);
    let spa_content_type = res_spa
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .expect("Content-Type header must be present")
        .to_str()
        .unwrap();
    assert!(spa_content_type.contains("text/html"), "SPA route must return text/html");

    // 3. API route is NOT intercepted by SPA fallback
    let res_api = client
        .get(format!("http://{}/api/v1/health", addr))
        .send()
        .await
        .expect("API request should succeed");
    assert_eq!(res_api.status(), 200);
    let api_content_type = res_api
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .expect("Content-Type header must be present")
        .to_str()
        .unwrap();
    assert!(api_content_type.contains("application/json"), "API route must return application/json");

    server_task.abort();
}
