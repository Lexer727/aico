use std::collections::HashSet;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Clone, Default)]
pub struct EmergencyKillSwitch {
    pids: Arc<Mutex<HashSet<u32>>>,
    triggered: Arc<AtomicBool>,
}

impl EmergencyKillSwitch {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register an active subprocess PID
    pub fn register_process(&self, pid: u32) {
        let mut set = self.pids.lock().unwrap();
        set.insert(pid);
    }

    /// Unregister a finished subprocess PID
    pub fn unregister_process(&self, pid: u32) {
        let mut set = self.pids.lock().unwrap();
        set.remove(&pid);
    }

    /// Get count of currently tracked active processes
    pub fn active_count(&self) -> usize {
        let set = self.pids.lock().unwrap();
        set.len()
    }

    /// Check if the emergency kill switch has been triggered
    pub fn is_emergency_triggered(&self) -> bool {
        self.triggered.load(Ordering::SeqCst)
    }

    /// Reset emergency triggered state
    pub fn reset(&self) {
        self.triggered.store(false, Ordering::SeqCst);
    }

    /// Terminate all tracked active processes immediately
    // @implements ft-core-security-auth::TASK-CORE-002-5::REQ-010
    pub fn kill_all(&self) -> Result<usize, std::io::Error> {
        self.triggered.store(true, Ordering::SeqCst);
        let mut set = self.pids.lock().unwrap();
        let pids_to_kill: Vec<u32> = set.drain().collect();
        let count = pids_to_kill.len();

        for pid in pids_to_kill {
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output();
            }

            #[cfg(not(windows))]
            {
                let _ = Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
            }
        }

        Ok(count)
    }
}
