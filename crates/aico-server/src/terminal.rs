use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tracing::{debug, warn};

use crate::server::AppState;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClientTerminalMessage {
    #[serde(rename = "init")]
    Init {
        shell: String,
        cwd: Option<String>,
    },
    #[serde(rename = "input")]
    Input {
        data: String,
    },
    #[serde(rename = "close")]
    Close,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum ServerTerminalMessage {
    #[serde(rename = "output")]
    Output {
        data: String,
    },
    #[serde(rename = "exit")]
    Exit {
        code: Option<i32>,
    },
    #[serde(rename = "error")]
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShellType {
    PowerShell,
    Cmd,
    Bash,
    Agy,
    Unknown(String),
}

impl ShellType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().trim() {
            "powershell" | "pwsh" | "ps" => ShellType::PowerShell,
            "cmd" | "cmd.exe" => ShellType::Cmd,
            "bash" | "gitbash" | "git-bash" | "sh" => ShellType::Bash,
            "agy" | "antigravity" | "ai" => ShellType::Agy,
            other => ShellType::Unknown(other.to_string()),
        }
    }
}

// @implements spec-ft-terminal-backend-stream-bridge::REQ-002
// @implements spec-ft-terminal-backend-stream-bridge::REQ-006
// @implements spec-ft-terminal-backend-stream-bridge::REQ-007
pub fn resolve_shell_command(shell: &ShellType) -> Result<(String, Vec<String>), String> {
    if cfg!(windows) {
        match shell {
            ShellType::PowerShell => Ok(("powershell.exe".to_string(), vec!["-NoLogo".to_string()])),
            ShellType::Cmd => Ok(("cmd.exe".to_string(), vec![])),
            ShellType::Bash => {
                let git_bash = Path::new(r"C:\Program Files\Git\bin\bash.exe");
                let git_bash_x86 = Path::new(r"C:\Program Files (x86)\Git\bin\bash.exe");
                if git_bash.exists() {
                    Ok((git_bash.to_string_lossy().to_string(), vec!["--login".to_string(), "-i".to_string()]))
                } else if git_bash_x86.exists() {
                    Ok((git_bash_x86.to_string_lossy().to_string(), vec!["--login".to_string(), "-i".to_string()]))
                } else {
                    Ok(("bash.exe".to_string(), vec!["--login".to_string(), "-i".to_string()]))
                }
            }
            ShellType::Agy => {
                // Check user appdata bin first, then fallback to PATH
                if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                    let agy_path = PathBuf::from(local_app_data).join(r"agy\bin\agy.exe");
                    if agy_path.exists() {
                        return Ok((agy_path.to_string_lossy().to_string(), vec![]));
                    }
                }
                Ok(("agy.exe".to_string(), vec![]))
            }
            ShellType::Unknown(u) => Err(format!("Unknown shell type requested: {}", u)),
        }
    } else {
        match shell {
            ShellType::PowerShell => Ok(("pwsh".to_string(), vec![])),
            ShellType::Cmd | ShellType::Bash => Ok(("bash".to_string(), vec!["-i".to_string()])),
            ShellType::Agy => Ok(("agy".to_string(), vec![])),
            ShellType::Unknown(u) => Err(format!("Unknown shell type requested: {}", u)),
        }
    }
}

// @implements spec-ft-terminal-backend-stream-bridge::REQ-001
pub async fn terminal_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_terminal_socket(socket, state))
}

// @implements spec-ft-terminal-backend-stream-bridge::REQ-001
// @implements spec-ft-terminal-backend-stream-bridge::REQ-002
// @implements spec-ft-terminal-backend-stream-bridge::REQ-003
// @implements spec-ft-terminal-backend-stream-bridge::REQ-004
// @implements spec-ft-terminal-backend-stream-bridge::REQ-005
// @implements spec-ft-terminal-backend-stream-bridge::REQ-007
async fn handle_terminal_socket(socket: WebSocket, _state: AppState) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Channel for forwarding messages from process stdout/stderr/exit to the WebSocket client
    let (out_tx, mut out_rx) = mpsc::channel::<ServerTerminalMessage>(128);

    // Spawn WebSocket outgoing sender pump
    let ws_send_task = tokio::spawn(async move {
        while let Some(msg) = out_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if ws_sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    let mut active_child: Option<Child> = None;
    let mut stdin_writer: Option<tokio::process::ChildStdin> = None;

    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                let parsed: Result<ClientTerminalMessage, _> = serde_json::from_str(&text);
                match parsed {
                    Ok(ClientTerminalMessage::Init { shell, cwd }) => {
                        let shell_type = ShellType::from_str(&shell);
                        match resolve_shell_command(&shell_type) {
                            Ok((prog, args)) => {
                                let mut cmd = Command::new(&prog);
                                cmd.args(&args);

                                if let Some(dir) = cwd {
                                    if !dir.is_empty() {
                                        cmd.current_dir(dir);
                                    }
                                }

                                cmd.stdin(Stdio::piped());
                                cmd.stdout(Stdio::piped());
                                cmd.stderr(Stdio::piped());
                                cmd.kill_on_drop(true);

                                match cmd.spawn() {
                                    Ok(mut child) => {
                                        let stdout = child.stdout.take();
                                        let stderr = child.stderr.take();
                                        stdin_writer = child.stdin.take();

                                        let tx_stdout = out_tx.clone();
                                        if let Some(mut r) = stdout {
                                            tokio::spawn(async move {
                                                let mut buf = [0u8; 4096];
                                                while let Ok(n) = r.read(&mut buf).await {
                                                    if n == 0 {
                                                        break;
                                                    }
                                                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                                                    if tx_stdout.send(ServerTerminalMessage::Output { data: chunk }).await.is_err() {
                                                        break;
                                                    }
                                                }
                                            });
                                        }

                                        let tx_stderr = out_tx.clone();
                                        if let Some(mut r) = stderr {
                                            tokio::spawn(async move {
                                                let mut buf = [0u8; 4096];
                                                while let Ok(n) = r.read(&mut buf).await {
                                                    if n == 0 {
                                                        break;
                                                    }
                                                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                                                    if tx_stderr.send(ServerTerminalMessage::Output { data: chunk }).await.is_err() {
                                                        break;
                                                    }
                                                }
                                            });
                                        }

                                        active_child = Some(child);
                                        debug!("Spawned terminal shell process: {}", prog);
                                    }
                                    Err(e) => {
                                        let _ = out_tx.send(ServerTerminalMessage::Error {
                                            message: format!("Failed to spawn shell '{}': {}", prog, e),
                                        }).await;
                                    }
                                }
                            }
                            Err(e) => {
                                let _ = out_tx.send(ServerTerminalMessage::Error {
                                    message: e,
                                }).await;
                            }
                        }
                    }
                    Ok(ClientTerminalMessage::Input { data }) => {
                        if let Some(ref mut writer) = stdin_writer {
                            let _ = writer.write_all(data.as_bytes()).await;
                            let _ = writer.flush().await;
                        }
                    }
                    Ok(ClientTerminalMessage::Close) => {
                        break;
                    }
                    Err(e) => {
                        warn!("Unrecognized terminal message: {}", e);
                    }
                }
            }
            Message::Close(_) => {
                break;
            }
            _ => {}
        }
    }

    // Clean up child process
    if let Some(mut child) = active_child {
        let _ = child.kill().await;
    }

    ws_send_task.abort();
}
