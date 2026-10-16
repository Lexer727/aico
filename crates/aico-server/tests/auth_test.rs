use aico_server::LanAuthenticator;

// @verifies spec-ft-core-host-runtime::REQ-004
// @verifies spec-ft-core-host-runtime::REQ-008
#[test]
fn test_lan_authenticator_token_generation_and_validation() {
    let auth = LanAuthenticator::new();
    assert!(!auth.token().is_empty(), "Generated token should not be empty");
    assert!(auth.token().len() >= 32, "Token should be at least 256 bits (32 chars hex/base64)");

    // Correct token verification
    assert!(auth.verify_token(auth.token()));

    // Invalid token verification
    assert!(!auth.verify_token("invalid_spoofed_token"));

    // Pairing URL generation
    let pairing_url = auth.pairing_url("192.168.1.100", 4242);
    assert!(pairing_url.contains("http://192.168.1.100:4242"));
    assert!(pairing_url.contains(&format!("token={}", auth.token())));
}

#[tokio::test]
// @verifies spec-ft-core-webui-shell::REQ-019
async fn test_pairing_rest_endpoint() {
    use aico_server::{AppState, HostServer, ServerConfig};

    let config = ServerConfig {
        base_port: 4350,
        max_port_attempts: 10,
        host: "127.0.0.1".to_string(),
    };
    let state = AppState::default();
    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Failed to bind server");

    let server_handle = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();
    let res = client
        .get(&format!("http://{}/api/v1/auth/pairing", addr))
        .send()
        .await
        .expect("Failed to call pairing endpoint");

    assert_eq!(res.status().as_u16(), 200);
    let body: serde_json::Value = res.json().await.expect("Failed to parse JSON");
    assert!(body.get("lan_ip").is_some());
    assert_eq!(body["port"], addr.port());
    assert!(body["token"].is_string());
    assert!(body["pairing_url"].as_str().unwrap().contains("token="));

    server_handle.abort();
}

