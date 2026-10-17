use aico_security::{CommandExecutor, ExecutionError};
use std::time::Duration;

// @verifies ft-core-security-auth::TASK-CORE-002-2::REQ-002
#[tokio::test]
async fn test_execute_command_captures_output() {
    let cwd = std::env::current_dir().unwrap();
    let cmd = "echo Hello AICO";

    let output = CommandExecutor::run_command(cmd, &cwd, Duration::from_secs(5))
        .await
        .expect("Command should execute cleanly");

    assert_eq!(output.exit_code, Some(0));
    assert!(output.stdout.contains("Hello AICO"));
}

// @verifies ft-core-security-auth::TASK-CORE-002-2::REQ-007
#[tokio::test]
async fn test_execute_command_aborts_on_timeout() {
    let cwd = std::env::current_dir().unwrap();
    // Sleep for 3 seconds but timeout is 200ms
    let cmd = if cfg!(windows) { "powershell -Command Start-Sleep -Seconds 3" } else { "sleep 3" };

    let result = CommandExecutor::run_command(cmd, &cwd, Duration::from_millis(200)).await;
    assert!(matches!(result, Err(ExecutionError::Timeout(_))), "Execution must abort on timeout");
}
