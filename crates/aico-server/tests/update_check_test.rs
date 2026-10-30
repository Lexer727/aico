// @verifies spec-ft-distribution-update-check::TASK-DISTRIBUTION-006-1::REQ-001
// @verifies spec-ft-distribution-update-check::TASK-DISTRIBUTION-006-1::REQ-003
use aico_server::{AppState, HostServer, ServerConfig};
use axum::{routing::get, Json, Router};
use serde_json::Value;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

static ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_update_check_detects_newer_version() {
    let _guard = ENV_LOCK.lock().await;
    let mock_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = mock_listener.local_addr().unwrap();

    let mock_app = Router::new().route(
        "/latest",
        get(|| async {
            Json(serde_json::json!({
                "tag_name": "v99.0.0",
                "html_url": "https://github.com/Lexer727/aico/releases/tag/v99.0.0"
            }))
        }),
    );

    tokio::spawn(async move {
        axum::serve(mock_listener, mock_app).await.unwrap();
    });

    std::env::set_var("AICO_UPDATE_API_URL", format!("http://{}/latest", mock_addr));
    std::env::remove_var("AICO_NO_UPDATE_CHECK");

    let mut config = ServerConfig::default();
    config.base_port = 4280;

    let mut server = HostServer::with_state(config, AppState::default());
    let addr = server.bind().await.unwrap();
    tokio::spawn(async move {
        server.serve().await.unwrap();
    });

    let client = reqwest::Client::new();
    let res = client
        .get(format!("http://{}/api/v1/system/update", addr))
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), 200);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["update_available"], true);
    assert_eq!(body["latest_version"], "99.0.0");
    assert_eq!(
        body["release_url"],
        "https://github.com/Lexer727/aico/releases/tag/v99.0.0"
    );
    assert!(!body["current_version"].as_str().unwrap().is_empty());
}

#[tokio::test]
async fn test_update_check_handles_older_or_equal_version() {
    let _guard = ENV_LOCK.lock().await;
    let mock_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = mock_listener.local_addr().unwrap();

    let mock_app = Router::new().route(
        "/latest",
        get(|| async {
            Json(serde_json::json!({
                "tag_name": "v0.0.1",
                "html_url": "https://github.com/Lexer727/aico/releases/tag/v0.0.1"
            }))
        }),
    );

    tokio::spawn(async move {
        axum::serve(mock_listener, mock_app).await.unwrap();
    });

    std::env::set_var("AICO_UPDATE_API_URL", format!("http://{}/latest", mock_addr));
    std::env::remove_var("AICO_NO_UPDATE_CHECK");

    let mut config = ServerConfig::default();
    config.base_port = 4281;

    let mut server = HostServer::with_state(config, AppState::default());
    let addr = server.bind().await.unwrap();
    tokio::spawn(async move {
        server.serve().await.unwrap();
    });

    let client = reqwest::Client::new();
    let res = client
        .get(format!("http://{}/api/v1/system/update", addr))
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), 200);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["update_available"], false);
    assert_eq!(body["latest_version"], "0.0.1");
}

#[tokio::test]
async fn test_update_check_fallback_on_unreachable_api() {
    let _guard = ENV_LOCK.lock().await;
    std::env::set_var("AICO_UPDATE_API_URL", "http://127.0.0.1:49998/nonexistent");
    std::env::remove_var("AICO_NO_UPDATE_CHECK");

    let mut config = ServerConfig::default();
    config.base_port = 4282;

    let mut server = HostServer::with_state(config, AppState::default());
    let addr = server.bind().await.unwrap();
    tokio::spawn(async move {
        server.serve().await.unwrap();
    });

    let client = reqwest::Client::new();
    let res = client
        .get(format!("http://{}/api/v1/system/update", addr))
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), 200);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["update_available"], false);
    assert!(body["latest_version"].is_null());
}

#[tokio::test]
async fn test_update_check_disabled_by_env_var() {
    let _guard = ENV_LOCK.lock().await;
    std::env::set_var("AICO_NO_UPDATE_CHECK", "1");

    let mut config = ServerConfig::default();
    config.base_port = 4283;

    let mut server = HostServer::with_state(config, AppState::default());
    let addr = server.bind().await.unwrap();
    tokio::spawn(async move {
        server.serve().await.unwrap();
    });

    let client = reqwest::Client::new();
    let res = client
        .get(format!("http://{}/api/v1/system/update", addr))
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), 200);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["update_available"], false);
    assert!(body["latest_version"].is_null());

    std::env::remove_var("AICO_NO_UPDATE_CHECK");
}

#[tokio::test]
async fn test_update_check_6_hour_caching() {
    let _guard = ENV_LOCK.lock().await;
    let call_count = Arc::new(AtomicUsize::new(0));
    let call_count_clone = call_count.clone();

    let mock_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = mock_listener.local_addr().unwrap();

    let mock_app = Router::new().route(
        "/latest",
        get(move || {
            let count = call_count_clone.clone();
            async move {
                count.fetch_add(1, Ordering::SeqCst);
                Json(serde_json::json!({
                    "tag_name": "v99.0.0",
                    "html_url": "https://github.com/Lexer727/aico/releases/tag/v99.0.0"
                }))
            }
        }),
    );

    tokio::spawn(async move {
        axum::serve(mock_listener, mock_app).await.unwrap();
    });

    std::env::set_var("AICO_UPDATE_API_URL", format!("http://{}/latest", mock_addr));
    std::env::remove_var("AICO_NO_UPDATE_CHECK");

    let mut config = ServerConfig::default();
    config.base_port = 4284;

    let mut server = HostServer::with_state(config, AppState::default());
    let addr = server.bind().await.unwrap();
    tokio::spawn(async move {
        server.serve().await.unwrap();
    });

    let client = reqwest::Client::new();
    // First query - hits upstream
    let _ = client
        .get(format!("http://{}/api/v1/system/update", addr))
        .send()
        .await
        .unwrap();
    assert_eq!(call_count.load(Ordering::SeqCst), 1);

    // Second query - must hit cache without incrementing counter
    let res2 = client
        .get(format!("http://{}/api/v1/system/update", addr))
        .send()
        .await
        .unwrap();
    assert_eq!(res2.status(), 200);
    assert_eq!(call_count.load(Ordering::SeqCst), 1);
}
