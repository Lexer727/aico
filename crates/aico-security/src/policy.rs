use std::path::Path;
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyDecision {
    pub tier: CommandTier,
    pub requires_gate: bool,
    pub reason: String,
}

pub struct PolicyEngine {
    workspace_root: std::path::PathBuf,
}

impl PolicyEngine {
    pub fn new<P: AsRef<Path>>(workspace_root: P) -> Self {
        Self {
            workspace_root: workspace_root.as_ref().to_path_buf(),
        }
    }

    /// Classify a command string and execution working directory
    pub fn classify_command<P: AsRef<Path>>(&self, _cmd: &str, _cwd: P) -> PolicyDecision {
        // Red test scaffold: stub returning dummy decision
        PolicyDecision {
            tier: CommandTier::Tier3DangerousOrEgress,
            requires_gate: true,
            reason: "Stub unclassified".to_string(),
        }
    }

    /// Check if target path violates sandboxing
    pub fn is_sandboxed<P: AsRef<Path>>(&self, _target_path: P) -> bool {
        // Red test scaffold: stub returning false
        false
    }
}
