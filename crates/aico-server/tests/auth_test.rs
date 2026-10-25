use aico_server::LanAuthenticator;

// @verifies ft-core-host-runtime::TASK-CORE-001-4::REQ-004
// @verifies ft-core-host-runtime::TASK-CORE-001-4::REQ-008
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
// @verifies ft-core-webui-shell::TASK-CORE-006-17::REQ-019
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

    // REQ-004: candidate_ips array returned with preferred flag and interface names
    assert!(body.get("candidate_ips").is_some());
    let candidates = body["candidate_ips"].as_array().expect("candidate_ips should be array");
    assert!(!candidates.is_empty(), "candidate_ips should not be empty");
    assert!(candidates.iter().any(|c| c["is_preferred"] == true));

    server_handle.abort();
}

// @verifies spec-ft-core-lan-ip-vpn-pairing-resolver::TASK-CORE-019-1::REQ-001
// @verifies spec-ft-core-lan-ip-vpn-pairing-resolver::TASK-CORE-019-1::REQ-002
// @verifies spec-ft-core-lan-ip-vpn-pairing-resolver::TASK-CORE-019-1::REQ-006
// @verifies spec-ft-core-lan-ip-vpn-pairing-resolver::TASK-CORE-019-2::REQ-004
#[test]
fn test_lan_ip_candidates_detection_and_vpn_exclusion() {
    let candidates = aico_server::server::detect_lan_ip_candidates();
    assert!(!candidates.is_empty(), "Candidates list should never be empty");

    // Exactly one preferred candidate
    let preferred_count = candidates.iter().filter(|c| c.is_preferred).count();
    assert_eq!(preferred_count, 1, "Exactly one candidate must be preferred");

    // Preferred candidate matches get_lan_ip()
    let preferred = candidates.iter().find(|c| c.is_preferred).unwrap();
    assert_eq!(aico_server::server::get_lan_ip(), preferred.ip);

    // No loopbacks or link-local in candidates
    for c in &candidates {
        assert!(!c.ip.starts_with("127."), "No 127.x.x.x unless sole fallback: {}", c.ip);
        assert!(!c.ip.starts_with("169.254."), "No APIPA link-local allowed: {}", c.ip);
    }
}

// @verifies spec-ft-core-lan-ip-vpn-pairing-resolver::TASK-CORE-019-1::REQ-003
#[test]
fn test_lan_ip_environment_variable_override() {
    std::env::set_var("AICO_LAN_IP", "192.168.178.250");
    let candidates = aico_server::server::detect_lan_ip_candidates();
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].ip, "192.168.178.250");
    assert!(candidates[0].is_preferred);
    assert_eq!(aico_server::server::get_lan_ip(), "192.168.178.250");
    std::env::remove_var("AICO_LAN_IP");
}

