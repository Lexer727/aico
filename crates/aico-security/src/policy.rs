use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CommandTier {
    /// Tier 1: Read-only, inspection, and local unit/contract test commands (Auto-allowed)
    Tier1Read,
    /// Tier 2: Workspace mutations within project root (Auto-allowed + synchronous audit log)
    Tier2WorkspaceWrite,
    /// Tier 3: Destructive filesystem actions, network egress, force pushes (Gated)
    Tier3DangerousOrEgress,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AutoModeState {
    Off,
    ReadOnly,
    Assisted,
    Autonomous,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyDecision {
    pub tier: CommandTier,
    pub requires_gate: bool,
    pub reason: String,
}

pub struct PolicyEngine {
    workspace_root: PathBuf,
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self {
            workspace_root: PathBuf::from("."),
        }
    }
}

impl PolicyEngine {
    pub fn new<P: AsRef<Path>>(workspace_root: P) -> Self {
        Self {
            workspace_root: Self::normalize_path(workspace_root.as_ref()),
        }
    }


    /// Normalizes path by resolving `.` and `..` components cleanly
    fn normalize_path(path: &Path) -> PathBuf {
        let mut normalized = PathBuf::new();
        for component in path.components() {
            match component {
                std::path::Component::ParentDir => {
                    normalized.pop();
                }
                std::path::Component::CurDir => {}
                _ => {
                    normalized.push(component.as_os_str());
                }
            }
        }
        normalized
    }

    /// Check if target path violates workspace sandboxing
    // @implements SPEC-CORE-002::REQ-008
    pub fn is_sandboxed<P: AsRef<Path>>(&self, target_path: P) -> bool {
        let normalized = Self::normalize_path(target_path.as_ref());
        normalized.starts_with(&self.workspace_root)
    }

    /// Classify a command string and execution working directory
    // @implements SPEC-CORE-002::REQ-001
    // @implements SPEC-CORE-002::REQ-009
    pub fn classify_command<P: AsRef<Path>>(&self, cmd: &str, _cwd: P) -> PolicyDecision {
        let trimmed = cmd.trim();

        // 1. Blacklisted / dangerous command patterns (Tier 3)
        let is_force_push = trimmed.contains("git push") && (trimmed.contains("--force") || trimmed.contains("-f"));
        let is_root_delete = trimmed.starts_with("rm -rf /") || trimmed.contains("rm -rf /*") || trimmed.contains("rmdir /s /q c:\\");
        let is_format_disk = trimmed.starts_with("format ") || trimmed.starts_with("mkfs");

        if is_force_push || is_root_delete || is_format_disk {
            return PolicyDecision {
                tier: CommandTier::Tier3DangerousOrEgress,
                requires_gate: true,
                reason: "Command matches blacklisted destructive or egress pattern".to_string(),
            };
        }

        // 2. Read-only inspection & test commands (Tier 1)
        let is_tier1 = trimmed.starts_with("cargo test")
            || trimmed.starts_with("git status")
            || trimmed.starts_with("git diff")
            || trimmed.starts_with("git log")
            || trimmed.starts_with("ls")
            || trimmed.starts_with("dir")
            || trimmed.starts_with("cat")
            || trimmed.starts_with("echo");

        if is_tier1 {
            return PolicyDecision {
                tier: CommandTier::Tier1Read,
                requires_gate: false,
                reason: "Safe read-only or testing command".to_string(),
            };
        }

        // 3. Workspace build / mutation commands (Tier 2)
        let is_tier2 = trimmed.starts_with("cargo build")
            || trimmed.starts_with("cargo check")
            || trimmed.starts_with("cargo add")
            || trimmed.starts_with("git add")
            || trimmed.starts_with("git commit");

        if is_tier2 {
            return PolicyDecision {
                tier: CommandTier::Tier2WorkspaceWrite,
                requires_gate: false,
                reason: "Workspace modification command with audit logging".to_string(),
            };
        }

        // 4. Default: Require approval for unclassified commands (Tier 3)
        PolicyDecision {
            tier: CommandTier::Tier3DangerousOrEgress,
            requires_gate: true,
            reason: "Unclassified command requires interactive approval".to_string(),
        }
    }

    /// Evaluate command policy with explicit AutoMode state
    // @implements SPEC-CORE-002::REQ-011
    pub fn evaluate_with_mode<P: AsRef<Path>>(&self, cmd: &str, cwd: P, mode: AutoModeState) -> PolicyDecision {
        let mut decision = self.classify_command(cmd, cwd);
        match mode {
            AutoModeState::Off => {
                if decision.tier == CommandTier::Tier2WorkspaceWrite || decision.tier == CommandTier::Tier3DangerousOrEgress {
                    decision.requires_gate = true;
                    decision.reason = format!("AutoMode is Off: {:?} requires interactive gate", decision.tier);
                }
            }
            AutoModeState::ReadOnly => {
                if decision.tier != CommandTier::Tier1Read {
                    decision.requires_gate = true;
                    decision.reason = format!("AutoMode is ReadOnly: {:?} requires interactive gate", decision.tier);
                }
            }
            AutoModeState::Assisted | AutoModeState::Autonomous => {
                // Tier 1 and Tier 2 proceed according to standard classification; Tier 3 retains requires_gate = true
            }
        }
        decision
    }
}

