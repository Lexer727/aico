use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::process::Command;

#[derive(Error, Debug)]
pub enum ExecutionError {
    #[error("Command execution timed out after {0:?}")]
    Timeout(Duration),
    #[error("Command process error: {0}")]
    ProcessError(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutionOutput {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

pub struct CommandExecutor;

impl CommandExecutor {
    /// Executes a shell command with timeout and process termination on cancellation
    // @implements spec-ft-core-security-auth::REQ-002
    // @implements spec-ft-core-security-auth::REQ-007
    pub async fn run_command<P: AsRef<Path>>(
        cmd: &str,
        cwd: P,
        timeout: Duration,
    ) -> Result<ExecutionOutput, ExecutionError> {
        let start = Instant::now();

        let mut command = if cfg!(windows) {
            let mut c = Command::new("cmd");
            c.args(["/C", cmd]);
            c
        } else {
            let mut c = Command::new("sh");
            c.args(["-c", cmd]);
            c
        };

        command.current_dir(cwd.as_ref());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());
        command.kill_on_drop(true);

        let child = command.spawn().map_err(|e| ExecutionError::ProcessError(e.to_string()))?;

        match tokio::time::timeout(timeout, child.wait_with_output()).await {
            Ok(Ok(output)) => {
                let duration_ms = start.elapsed().as_millis() as u64;
                Ok(ExecutionOutput {
                    exit_code: output.status.code(),
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    duration_ms,
                })
            }
            Ok(Err(e)) => Err(ExecutionError::ProcessError(e.to_string())),
            Err(_) => Err(ExecutionError::Timeout(timeout)),
        }
    }
}
