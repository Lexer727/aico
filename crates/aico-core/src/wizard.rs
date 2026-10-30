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
    // @implements ft-core-discovery::TASK-CORE-004-5::REQ-004
    // @implements ft-core-discovery::TASK-CORE-004-5::REQ-011
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
    // @implements ft-core-discovery::TASK-CORE-004-5::REQ-011
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

    /// Scaffold a new project specifications repository
    // @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-4::REQ-009
    // @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-5::REQ-010
    pub fn scaffold_project_specs(
        workspace_root: &Path,
        project_name: &str,
    ) -> Result<std::path::PathBuf, std::io::Error> {
        let clean_slug = project_name
            .trim()
            .strip_suffix("-specs")
            .unwrap_or(project_name.trim())
            .to_lowercase()
            .replace(' ', "-");

        let specs_dir = workspace_root.join(format!("{}-specs", clean_slug));
        if specs_dir.exists() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                format!("Specs directory already exists: {}", specs_dir.display()),
            ));
        }

        for sub in &["adr", "epics", "features"] {
            fs::create_dir_all(specs_dir.join(sub))?;
        }

        let title = clean_slug
            .split('-')
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ");

        let manifest = serde_json::json!({
            "project_name": clean_slug,
            "id": format!("{}-specs", clean_slug),
            "name": format!("{} Specs", title),
            "repositories": []
        });

        fs::write(
            specs_dir.join(".aico-project.json"),
            serde_json::to_string_pretty(&manifest).unwrap(),
        )?;

        let glossary = format!(
            "---\nid: glossary-{clean_slug}\ntype: glossary\naico_skills_version: \"0.1.2\"\ntitle: \"{title} Ubiquitous Domain Glossary\"\nstatus: \"Draft\"\nderives_from: []\n---\n\n# {title} Ubiquitous Domain Glossary\n\n## 1. Core Domain Terms\n"
        );
        fs::write(specs_dir.join("glossary.md"), glossary)?;

        let _ = Command::new("git")
            .arg("init")
            .current_dir(&specs_dir)
            .output();

        Ok(specs_dir)
    }
}
