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
