use std::process::Command;
use aico_security::EmergencyKillSwitch;

// @verifies spec-ft-core-security-auth::REQ-010
#[tokio::test]
async fn test_emergency_kill_switch() {
    let kill_switch = EmergencyKillSwitch::new();

    // Spawn a long-running background sleep process
    #[cfg(windows)]
    let mut child = Command::new("powershell")
        .args(["-Command", "Start-Sleep -Seconds 30"])
        .spawn()
        .expect("Failed to spawn background sleep process");

    #[cfg(not(windows))]
    let mut child = Command::new("sleep")
        .arg("30")
        .spawn()
        .expect("Failed to spawn background sleep process");

    let pid = child.id();
    kill_switch.register_process(pid);

    assert_eq!(kill_switch.active_count(), 1);
    assert!(!kill_switch.is_emergency_triggered());

    // Trigger emergency kill switch
    let killed_count = kill_switch.kill_all().expect("Failed to execute emergency kill");

    assert_eq!(killed_count, 1);
    assert_eq!(kill_switch.active_count(), 0);
    assert!(kill_switch.is_emergency_triggered());

    // Verify the child process is terminated
    let status = child.wait().expect("Failed to wait on killed child");
    assert!(!status.success());
}
