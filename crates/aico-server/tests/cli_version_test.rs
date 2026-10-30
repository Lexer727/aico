// @verifies spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-006
// @verifies spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-005
use std::process::Command;

#[test]
fn test_aico_server_cli_version_flag() {
    let bin_path = env!("CARGO_BIN_EXE_aico-server");
    let output = Command::new(bin_path)
        .arg("--version")
        .output()
        .expect("Failed to execute aico-server --version");

    assert!(output.status.success(), "Exit status should be 0");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let expected_version = env!("CARGO_PKG_VERSION");
    assert!(
        stdout.contains(&format!("aico-server {}", expected_version)),
        "stdout should contain 'aico-server {}', but got: {}",
        expected_version,
        stdout
    );
}
