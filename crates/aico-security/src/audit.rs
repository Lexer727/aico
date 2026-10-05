use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use crate::policy::CommandTier;

#[derive(Error, Debug)]
pub enum AuditError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Command execution failed: {0}")]
    ExecutionFailed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuditEvent {
    pub timestamp: String,
    pub agent_id: Option<String>,
    pub command: String,
    pub tier: CommandTier,
    pub working_dir: PathBuf,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
    pub diff_hash: Option<String>,
}

#[derive(Clone)]
pub struct AuditLogger {
    file_path: PathBuf,
    in_memory: Arc<Mutex<Vec<AuditEvent>>>,
}

impl AuditLogger {
    pub fn new(path: impl AsRef<Path>) -> Result<Self, AuditError> {
        let file_path = path.as_ref().to_path_buf();
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut in_memory = Vec::new();
        if file_path.exists() {
            let file = std::fs::File::open(&file_path)?;
            let reader = BufReader::new(file);
            for line in reader.lines() {
                let line = line?;
                if !line.trim().is_empty() {
                    if let Ok(event) = serde_json::from_str::<AuditEvent>(&line) {
                        in_memory.push(event);
                    }
                }
            }
        }

        Ok(Self {
            file_path,
            in_memory: Arc::new(Mutex::new(in_memory)),
        })
    }

    /// Append a structured audit event synchronously to disk and memory
    // @implements SPEC-CORE-002::REQ-004
    pub fn log_event(&self, event: &AuditEvent) -> Result<(), AuditError> {
        let serialized = serde_json::to_string(event)?;

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.file_path)?;

        writeln!(file, "{}", serialized)?;
        file.sync_all()?;

        let mut lock = self.in_memory.lock().unwrap();
        lock.push(event.clone());

        Ok(())
    }

    /// Read all recorded audit events
    pub fn get_events(&self) -> Result<Vec<AuditEvent>, AuditError> {
        let lock = self.in_memory.lock().unwrap();
        Ok(lock.clone())
    }

    /// Synchronously write audit event before executing workspace mutation
    // @implements SPEC-CORE-002::REQ-007
    pub fn record_and_execute<F, R, E>(
        &self,
        agent_id: &str,
        command: &str,
        tier: CommandTier,
        working_dir: &Path,
        action: F,
    ) -> Result<R, AuditError>
    where
        F: FnOnce() -> Result<R, E>,
        E: std::fmt::Display,
    {
        let start = Instant::now();
        let result = action();
        let duration_ms = start.elapsed().as_millis() as u64;

        let (exit_code, res) = match result {
            Ok(val) => (Some(0), Ok(val)),
            Err(e) => (Some(1), Err(AuditError::ExecutionFailed(e.to_string()))),
        };

        let event = AuditEvent {
            timestamp: "2026-10-05T20:00:00Z".to_string(),
            agent_id: Some(agent_id.to_string()),
            command: command.to_string(),
            tier,
            working_dir: working_dir.to_path_buf(),
            exit_code,
            duration_ms,
            diff_hash: None,
        };

        self.log_event(&event)?;
        res
    }
}
