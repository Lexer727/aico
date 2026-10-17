use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use futures_util::{SinkExt, StreamExt};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;
use tracing::{debug, warn};

use crate::server::AppState;

const DEFAULT_COLS: u16 = 120;
const DEFAULT_ROWS: u16 = 30;

/// A session that has emitted output within this window is considered `working`.
const WORKING_WINDOW_MS: u64 = 1500;

/// Maximum UTF-8 scrollback bytes retained per named terminal tab for replay across F5 reloads.
const MAX_SCROLLBACK_BYTES: usize = 128 * 1024;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClientTerminalMessage {
    #[serde(rename = "init")]
    Init {
        #[serde(default)]
        tab_id: Option<String>,
        shell: String,
        cwd: Option<String>,
        cols: Option<u16>,
        rows: Option<u16>,
    },
    #[serde(rename = "input")]
    Input { data: String },
    #[serde(rename = "resize")]
    Resize { cols: u16, rows: u16 },
    #[serde(rename = "close")]
    Close,
    #[serde(rename = "kill")]
    Kill,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum ServerTerminalMessage {
    #[serde(rename = "output")]
    Output { data: String },
    #[serde(rename = "exit")]
    Exit { code: Option<i32> },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShellType {
    PowerShell,
    Cmd,
    Bash,
    Agy,
    Claude,
    Unknown(String),
}

impl ShellType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().trim() {
            "powershell" | "pwsh" | "ps" => ShellType::PowerShell,
            "cmd" | "cmd.exe" => ShellType::Cmd,
            "bash" | "gitbash" | "git-bash" | "sh" => ShellType::Bash,
            "agy" | "antigravity" | "ai" => ShellType::Agy,
            "claude" | "claude-code" => ShellType::Claude,
            other => ShellType::Unknown(other.to_string()),
        }
    }

    /// Canonical identifier reported by the session registry.
    pub fn id(&self) -> String {
        match self {
            ShellType::PowerShell => "powershell".into(),
            ShellType::Cmd => "cmd".into(),
            ShellType::Bash => "bash".into(),
            ShellType::Agy => "agy".into(),
            ShellType::Claude => "claude".into(),
            ShellType::Unknown(u) => u.clone(),
        }
    }

    pub fn is_ai(&self) -> bool {
        matches!(self, ShellType::Agy | ShellType::Claude)
    }
}

/// Resolve the executable and arguments for a shell. AI CLIs are launched
/// directly (no wrapper REPL) because they now run inside a real PTY and can
/// drive their own interactive TUI.
// @implements ft-terminal-backend-stream-bridge::TASK-TERM-001-1::REQ-002
// @implements ft-terminal-backend-stream-bridge::TASK-TERM-001-1::REQ-006
// @implements ft-terminal-backend-stream-bridge::TASK-TERM-001-3::REQ-007
// @implements ft-terminal-conpty-bridge::TASK-PTY-006::REQ-003
pub fn resolve_shell_command(shell: &ShellType) -> Result<(String, Vec<String>), String> {
    if cfg!(windows) {
        match shell {
            ShellType::PowerShell => Ok(("powershell.exe".to_string(), vec!["-NoLogo".to_string()])),
            ShellType::Cmd => Ok(("cmd.exe".to_string(), vec![])),
            ShellType::Bash => {
                let git_bash = Path::new(r"C:\Program Files\Git\bin\bash.exe");
                let git_bash_x86 = Path::new(r"C:\Program Files (x86)\Git\bin\bash.exe");
                let args = vec!["--login".to_string(), "-i".to_string()];
                if git_bash.exists() {
                    Ok((git_bash.to_string_lossy().to_string(), args))
                } else if git_bash_x86.exists() {
                    Ok((git_bash_x86.to_string_lossy().to_string(), args))
                } else {
                    Ok(("bash.exe".to_string(), args))
                }
            }
            ShellType::Agy => {
                let local = std::env::var("LOCALAPPDATA")
                    .ok()
                    .map(|d| PathBuf::from(d).join(r"agy\bin\agy.exe"))
                    .filter(|p| p.exists());
                Ok((
                    local.map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| "agy.exe".to_string()),
                    vec![],
                ))
            }
            // Native Claude Code on Windows installs to %USERPROFILE%\.local\bin\claude.exe; fall back to cmd /c claude.
            ShellType::Claude => {
                let local_bin = std::env::var("USERPROFILE")
                    .ok()
                    .map(|d| PathBuf::from(d).join(r".local\bin\claude.exe"))
                    .filter(|p| p.exists());
                if let Some(bin) = local_bin {
                    Ok((bin.to_string_lossy().to_string(), vec![]))
                } else {
                    Ok(("cmd.exe".to_string(), vec!["/c".to_string(), "claude".to_string()]))
                }
            }
            ShellType::Unknown(u) => Err(format!("Unknown shell type requested: {}", u)),
        }
    } else {
        match shell {
            ShellType::PowerShell => Ok(("pwsh".to_string(), vec![])),
            ShellType::Cmd | ShellType::Bash => Ok(("bash".to_string(), vec!["-i".to_string()])),
            ShellType::Agy => Ok(("agy".to_string(), vec![])),
            ShellType::Claude => Ok(("claude".to_string(), vec![])),
            ShellType::Unknown(u) => Err(format!("Unknown shell type requested: {}", u)),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Session registry
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TerminalSessionInfo {
    pub id: u64,
    pub shell: String,
    pub is_ai: bool,
    /// `working` if the session produced output in the last 1.5s, otherwise `waiting_for_input`.
    pub state: String,
}

struct SessionEntry {
    shell: ShellType,
    last_output_ms: Arc<AtomicU64>,
}

/// Process-wide registry of live PTY sessions.
// @implements ft-terminal-conpty-bridge::TASK-PTY-003::REQ-008
// @implements ft-terminal-conpty-bridge::TASK-PTY-007::REQ-011
#[derive(Default)]
pub struct TerminalSessionRegistry {
    next_id: AtomicU64,
    sessions: Mutex<HashMap<u64, SessionEntry>>,
    named_sessions: Mutex<HashMap<String, (u64, Arc<PtySession>)>>,
}

impl TerminalSessionRegistry {
    fn register(&self, shell: ShellType, last_output_ms: Arc<AtomicU64>) -> u64 {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        self.sessions.lock().unwrap().insert(id, SessionEntry { shell, last_output_ms });
        id
    }

    pub fn register_shell(&self, shell: ShellType) -> u64 {
        let last_output_ms = Arc::new(AtomicU64::new(now_ms()));
        self.register(shell, last_output_ms)
    }

    pub fn touch(&self, id: u64) {
        if let Some(entry) = self.sessions.lock().unwrap().get(&id) {
            entry.last_output_ms.store(now_ms(), Ordering::Relaxed);
        }
    }

    pub fn unregister(&self, id: u64) {
        self.sessions.lock().unwrap().remove(&id);
    }

    fn get_named(&self, tab_id: &str) -> Option<(u64, Arc<PtySession>)> {
        let mut map = self.named_sessions.lock().unwrap();
        if let Some((id, pty)) = map.get(tab_id) {
            if !pty.is_exited() {
                return Some((*id, pty.clone()));
            }
        }
        if let Some((id, old_pty)) = map.remove(tab_id) {
            self.sessions.lock().unwrap().remove(&id);
            old_pty.shutdown();
        }
        None
    }

    fn insert_named(&self, tab_id: String, id: u64, pty: Arc<PtySession>) {
        if let Some((old_id, old_pty)) = self.named_sessions.lock().unwrap().insert(tab_id, (id, pty)) {
            self.sessions.lock().unwrap().remove(&old_id);
            old_pty.shutdown();
        }
    }

    fn remove_named(&self, tab_id: &str) -> Option<(u64, Arc<PtySession>)> {
        let removed = self.named_sessions.lock().unwrap().remove(tab_id);
        if let Some((id, _)) = &removed {
            self.sessions.lock().unwrap().remove(id);
        }
        removed
    }

    pub fn list(&self) -> Vec<TerminalSessionInfo> {
        let now = now_ms();
        let mut out: Vec<_> = self
            .sessions
            .lock()
            .unwrap()
            .iter()
            .map(|(id, e)| {
                let last = e.last_output_ms.load(Ordering::Relaxed);
                let working = last != 0 && now.saturating_sub(last) < WORKING_WINDOW_MS;
                TerminalSessionInfo {
                    id: *id,
                    shell: e.shell.id(),
                    is_ai: e.shell.is_ai(),
                    state: if working { "working" } else { "waiting_for_input" }.to_string(),
                }
            })
            .collect();
        out.sort_by_key(|s| s.id);
        out
    }
}

// @implements ft-terminal-conpty-bridge::TASK-PTY-003::REQ-008
pub async fn terminal_sessions_handler(State(state): State<AppState>) -> Json<Vec<TerminalSessionInfo>> {
    Json(state.terminal_sessions.list())
}

// ---------------------------------------------------------------------------
// PTY session
// ---------------------------------------------------------------------------

/// Owns the PTY master, rolling scrollback buffer, and I/O threads of one terminal session.
// @implements ft-terminal-conpty-bridge::TASK-PTY-007::REQ-011
// @implements ft-terminal-conpty-bridge::TASK-PTY-008::REQ-012
struct PtySession {
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    input_tx: std::sync::mpsc::Sender<Vec<u8>>,
    killer: Mutex<Option<Box<dyn ChildKiller + Send + Sync>>>,
    pid: Option<u32>,
    client_txs: Arc<Mutex<Vec<mpsc::Sender<ServerTerminalMessage>>>>,
    scrollback: Arc<Mutex<String>>,
    exited: Arc<Mutex<Option<Option<i32>>>>,
}

impl PtySession {
    fn write(&self, data: &[u8]) {
        let _ = self.input_tx.send(data.to_vec());
    }

    // @implements ft-terminal-conpty-bridge::TASK-PTY-004::REQ-005
    fn resize(&self, cols: u16, rows: u16) {
        if let Some(ref master) = *self.master.lock().unwrap() {
            if let Err(e) = master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }) {
                warn!("PTY resize failed: {}", e);
            }
        }
    }

    fn is_exited(&self) -> bool {
        self.exited.lock().unwrap().is_some()
    }

    /// Attach a WebSocket output channel and return a snapshot of the buffered scrollback.
    // @implements ft-terminal-conpty-bridge::TASK-PTY-007::REQ-011
    // @implements ft-terminal-conpty-bridge::TASK-PTY-008::REQ-012
    fn attach_client(&self, out_tx: mpsc::Sender<ServerTerminalMessage>) -> String {
        let history = self.scrollback.lock().unwrap().clone();
        let mut clients = self.client_txs.lock().unwrap();
        clients.retain(|tx| !tx.is_closed());
        if !clients.iter().any(|tx| tx.same_channel(&out_tx)) {
            clients.push(out_tx);
        }
        history
    }

    /// Detach the given WebSocket output channel.
    // @implements ft-terminal-conpty-bridge::TASK-PTY-008::REQ-012
    fn detach_client(&self, expected_tx: &mpsc::Sender<ServerTerminalMessage>) {
        let mut clients = self.client_txs.lock().unwrap();
        clients.retain(|tx| !tx.same_channel(expected_tx) && !tx.is_closed());
    }

    /// Kill the whole process tree, then release PTY handles off the async runtime
    /// (closing a pseudo console can block while output is drained).
    // @implements ft-terminal-conpty-bridge::TASK-PTY-007::REQ-006
    fn shutdown(&self) {
        self.client_txs.lock().unwrap().clear();
        #[cfg(windows)]
        if let Some(pid) = self.pid {
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .output();
        }
        if let Some(mut killer) = self.killer.lock().unwrap().take() {
            let _ = killer.kill();
        }
        if let Some(master) = self.master.lock().unwrap().take() {
            std::thread::spawn(move || drop(master));
        }
    }
}

/// Incremental UTF-8 decoder that never splits a multi-byte character across chunks.
struct Utf8Stream {
    pending: Vec<u8>,
}

impl Utf8Stream {
    fn push(&mut self, bytes: &[u8]) -> String {
        self.pending.extend_from_slice(bytes);
        let mut out = String::new();
        loop {
            match std::str::from_utf8(&self.pending) {
                Ok(s) => {
                    out.push_str(s);
                    self.pending.clear();
                    return out;
                }
                Err(e) => {
                    let valid = e.valid_up_to();
                    out.push_str(std::str::from_utf8(&self.pending[..valid]).unwrap());
                    match e.error_len() {
                        // Genuinely invalid bytes: replace and continue.
                        Some(len) => {
                            out.push('\u{FFFD}');
                            self.pending.drain(..valid + len);
                        }
                        // Incomplete trailing sequence: keep it for the next chunk.
                        None => {
                            self.pending.drain(..valid);
                            return out;
                        }
                    }
                }
            }
        }
    }
}

// @implements ft-terminal-conpty-bridge::TASK-PTY-004::REQ-001
// @implements ft-terminal-conpty-bridge::TASK-PTY-006::REQ-003
// @implements ft-terminal-conpty-bridge::TASK-PTY-006::REQ-007
// @implements ft-terminal-conpty-bridge::TASK-PTY-006::REQ-010
// @implements ft-terminal-conpty-bridge::TASK-PTY-007::REQ-011
fn spawn_pty_session(
    shell: &ShellType,
    working_dir: &Path,
    cols: u16,
    rows: u16,
    out_tx: mpsc::Sender<ServerTerminalMessage>,
    last_output_ms: Arc<AtomicU64>,
) -> Result<Arc<PtySession>, String> {
    let (prog, args) = resolve_shell_command(shell)?;

    let pair = native_pty_system()
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("Failed to allocate PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&prog);
    cmd.args(&args);
    cmd.cwd(working_dir);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell '{}': {}", prog, e))?;
    // The slave handle must be released so the reader sees EOF when the child exits.
    drop(pair.slave);

    let pid = child.process_id();
    let killer = child.clone_killer();
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let mut writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Writer thread: WebSocket -> PTY, so a slow child can never stall the async runtime.
    let (input_tx, input_rx) = std::sync::mpsc::channel::<Vec<u8>>();
    std::thread::spawn(move || {
        while let Ok(bytes) = input_rx.recv() {
            if writer.write_all(&bytes).and_then(|_| writer.flush()).is_err() {
                break;
            }
        }
    });

    let client_txs = Arc::new(Mutex::new(vec![out_tx]));
    let scrollback = Arc::new(Mutex::new(String::new()));
    let exited = Arc::new(Mutex::new(None));

    // Reader thread: PTY -> Scrollback + active WebSocket clients.
    // @implements ft-terminal-conpty-bridge::TASK-PTY-008::REQ-012
    let client_txs_reader = client_txs.clone();
    let scrollback_reader = scrollback.clone();
    let dsr_reply_tx = input_tx.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let mut decoder = Utf8Stream { pending: Vec::new() };
        let mut answered_dsr = false;
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    last_output_ms.store(now_ms(), Ordering::Relaxed);
                    let mut data = decoder.push(&buf[..n]);
                    if !answered_dsr && data.contains("\x1b[6n") {
                        answered_dsr = true;
                        let _ = dsr_reply_tx.send(b"\x1b[1;1R".to_vec());
                        data = data.replacen("\x1b[6n", "", 1);
                    }
                    if !data.is_empty() {
                        {
                            let mut sb = scrollback_reader.lock().unwrap();
                            sb.push_str(&data);
                            if sb.len() > MAX_SCROLLBACK_BYTES {
                                let mut drop_len = sb.len() - MAX_SCROLLBACK_BYTES;
                                while drop_len < sb.len() && !sb.is_char_boundary(drop_len) {
                                    drop_len += 1;
                                }
                                sb.drain(..drop_len);
                            }
                        }
                        let clients = client_txs_reader.lock().unwrap().clone();
                        for tx in clients {
                            if !tx.is_closed() {
                                let _ = tx.blocking_send(ServerTerminalMessage::Output { data: data.clone() });
                            }
                        }
                    }
                }
            }
        }
    });

    // Exit watcher.
    let client_txs_exit = client_txs.clone();
    let exited_writer = exited.clone();
    std::thread::spawn(move || {
        let code = child.wait().ok().map(|s| s.exit_code() as i32);
        *exited_writer.lock().unwrap() = Some(code);
        let clients = client_txs_exit.lock().unwrap().clone();
        for tx in clients {
            if !tx.is_closed() {
                let _ = tx.blocking_send(ServerTerminalMessage::Exit { code });
            }
        }
    });

    debug!("Spawned PTY session: {} {:?} ({}x{})", prog, args, cols, rows);
    Ok(Arc::new(PtySession {
        master: Mutex::new(Some(pair.master)),
        input_tx,
        killer: Mutex::new(Some(killer)),
        pid,
        client_txs,
        scrollback,
        exited,
    }))
}

// ---------------------------------------------------------------------------
// WebSocket handler
// ---------------------------------------------------------------------------

// @implements ft-terminal-backend-stream-bridge::TASK-TERM-001-3::REQ-001
// @implements ft-terminal-conpty-bridge::TASK-PTY-004::REQ-002
pub async fn terminal_ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_terminal_socket(socket, state))
}

// @implements ft-terminal-conpty-bridge::TASK-PTY-006::REQ-003
// @implements ft-terminal-panel-ui::TASK-TERM-002-7::REQ-011
async fn resolve_working_dir(state: &AppState, cwd: Option<String>) -> PathBuf {
    match cwd {
        Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
        _ => {
            let reg = state.registry.read().await;
            match reg.get_active() {
                Some(active) => active
                    .specs_path
                    .parent()
                    .filter(|p| !p.as_os_str().is_empty())
                    .map(Path::to_path_buf)
                    .unwrap_or_else(|| active.specs_path.clone()),
                None => std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            }
        }
    }
}

// @implements ft-terminal-conpty-bridge::TASK-PTY-004::REQ-002
// @implements ft-terminal-conpty-bridge::TASK-PTY-004::REQ-004
// @implements ft-terminal-conpty-bridge::TASK-PTY-004::REQ-005
// @implements ft-terminal-conpty-bridge::TASK-PTY-007::REQ-006
// @implements ft-terminal-conpty-bridge::TASK-PTY-002::REQ-009
// @implements ft-terminal-conpty-bridge::TASK-PTY-007::REQ-011
async fn handle_terminal_socket(socket: WebSocket, state: AppState) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (out_tx, mut out_rx) = mpsc::channel::<ServerTerminalMessage>(256);

    let ws_send_task = tokio::spawn(async move {
        while let Some(msg) = out_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if ws_sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    let mut session: Option<(u64, Option<String>, Arc<PtySession>)> = None;
    let mut explicit_close = false;

    while let Some(Ok(msg)) = ws_receiver.next().await {
        let text = match msg {
            Message::Text(text) => text,
            Message::Close(_) => break,
            _ => continue,
        };

        match serde_json::from_str::<ClientTerminalMessage>(&text) {
            Ok(ClientTerminalMessage::Init { tab_id, shell, cwd, cols, rows }) => {
                if let Some((old_id, old_tab_id, old_pty)) = session.take() {
                    if let Some(tid) = old_tab_id {
                        state.terminal_sessions.remove_named(&tid);
                    } else {
                        state.terminal_sessions.unregister(old_id);
                    }
                    old_pty.shutdown();
                }

                let normalized_tab_id = tab_id.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
                let target_cols = cols.unwrap_or(DEFAULT_COLS).max(1);
                let target_rows = rows.unwrap_or(DEFAULT_ROWS).max(1);

                // Re-attach to an existing named PTY session if one is alive for `tab_id`
                if let Some(ref tid) = normalized_tab_id {
                    if let Some((existing_id, existing_pty)) = state.terminal_sessions.get_named(tid) {
                        let history = existing_pty.attach_client(out_tx.clone());
                        existing_pty.resize(target_cols, target_rows);
                        if !history.is_empty() {
                            let _ = out_tx.send(ServerTerminalMessage::Output { data: history }).await;
                        }
                        session = Some((existing_id, Some(tid.clone()), existing_pty));
                        continue;
                    }
                }

                let shell_type = ShellType::from_str(&shell);
                let working_dir = resolve_working_dir(&state, cwd).await;
                let last_output = Arc::new(AtomicU64::new(0));
                match spawn_pty_session(
                    &shell_type,
                    &working_dir,
                    target_cols,
                    target_rows,
                    out_tx.clone(),
                    last_output.clone(),
                ) {
                    Ok(pty) => {
                        let id = state.terminal_sessions.register(shell_type, last_output);
                        if let Some(ref tid) = normalized_tab_id {
                            state.terminal_sessions.insert_named(tid.clone(), id, pty.clone());
                        }
                        session = Some((id, normalized_tab_id, pty));
                    }
                    Err(message) => {
                        let _ = out_tx.send(ServerTerminalMessage::Error { message }).await;
                    }
                }
            }
            Ok(ClientTerminalMessage::Input { data }) => {
                if let Some((_, _, ref pty)) = session {
                    pty.write(data.as_bytes());
                }
            }
            Ok(ClientTerminalMessage::Resize { cols, rows }) => {
                if let Some((_, _, ref pty)) = session {
                    pty.resize(cols.max(1), rows.max(1));
                }
            }
            Ok(ClientTerminalMessage::Close) | Ok(ClientTerminalMessage::Kill) => {
                explicit_close = true;
                break;
            }
            Err(e) => warn!("Unrecognized terminal message: {}", e),
        }
    }

    if let Some((id, tab_id, pty)) = session.take() {
        if explicit_close || tab_id.is_none() || pty.is_exited() {
            if let Some(tid) = tab_id {
                state.terminal_sessions.remove_named(&tid);
            } else {
                state.terminal_sessions.unregister(id);
            }
            pty.shutdown();
        } else {
            // Named tab session disconnected without explicit close/kill (e.g. F5 browser reload):
            // detach the dead WebSocket sender and keep the PTY running for re-attachment.
            pty.detach_client(&out_tx);
        }
    }
    ws_send_task.abort();
}

#[cfg(test)]
mod tests {
    use super::Utf8Stream;

    #[test]
    fn utf8_stream_reassembles_split_multibyte_chars() {
        let mut d = Utf8Stream { pending: Vec::new() };
        let bytes = "ä→✓".as_bytes();
        let mut out = String::new();
        for b in bytes {
            out.push_str(&d.push(std::slice::from_ref(b)));
        }
        assert_eq!(out, "ä→✓");
    }

    #[test]
    fn utf8_stream_replaces_invalid_bytes() {
        let mut d = Utf8Stream { pending: Vec::new() };
        assert_eq!(d.push(&[b'a', 0xFF, b'b']), "a\u{FFFD}b");
    }
}
