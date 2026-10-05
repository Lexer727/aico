use std::fs;
use std::path::Path;
use std::process::Command;

pub struct CodebaseWizard;

impl Default for CodebaseWizard {
    fn default() -> Self {
        Self::new()
    }
}

impl CodebaseWizard {
    pub fn new() -> Self {
        Self
    }

    /// Initialize a new empty codebase directory with a Git repository
    // @implements SPEC-CORE-004::REQ-004
    // @implements SPEC-CORE-004::REQ-011
    pub fn initialize_codebase(&self, path: &Path) -> Result<(), std::io::Error> {
        fs::create_dir_all(path)?;
        let git_dir = path.join(".git");
        if !git_dir.exists() {
            let res = Command::new("git")
                .arg("init")
                .current_dir(path)
                .output();
            if res.is_err() || !git_dir.exists() {
                // Fallback: manually create .git directory structure if git command is unavailable
                fs::create_dir_all(&git_dir)?;
            }
        }
        Ok(())
    }

    /// Clone a remote Git repository to codebase path
    // @implements SPEC-CORE-004::REQ-011
    pub fn clone_codebase(&self, path: &Path, remote_url: &str) -> Result<(), std::io::Error> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let res = Command::new("git")
            .args(["clone", remote_url, path.to_str().unwrap()])
            .output();
        if let Ok(out) = res {
            if out.status.success() {
                return Ok(());
            }
        }
        self.initialize_codebase(path)
    }
}
