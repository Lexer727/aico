use rand::RngCore;

pub struct LanAuthenticator {
    token: String,
}

impl LanAuthenticator {
    /// Generates a cryptographically random 256-bit token (64 hex characters)
    // @implements SPEC-CORE-001::REQ-004
    pub fn new() -> Self {
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        let token = bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>();
        Self { token }
    }

    pub fn with_token(token: String) -> Self {
        Self { token }
    }

    pub fn token(&self) -> &str {
        &self.token
    }

    /// Verifies if a provided Bearer token or query parameter matches the authorized session token
    // @implements SPEC-CORE-001::REQ-008
    pub fn verify_token(&self, provided: &str) -> bool {
        let clean_token = provided.trim().trim_start_matches("Bearer ").trim();
        clean_token == self.token
    }

    /// Formats the LAN pairing URL
    // @implements SPEC-CORE-001::REQ-004
    pub fn pairing_url(&self, host_ip: &str, port: u16) -> String {
        format!("http://{}:{}/?token={}", host_ip, port, self.token)
    }
}

impl Default for LanAuthenticator {
    fn default() -> Self {
        Self::new()
    }
}
