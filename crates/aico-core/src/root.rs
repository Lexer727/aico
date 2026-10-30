use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use thiserror::Error;

static GLOBAL_AICO_ROOT: OnceLock<PathBuf> = OnceLock::new();

#[derive(Error, Debug, PartialEq, Eq)]
pub enum RootResolutionError {
    #[error("Path provided via {origin} does not exist: {path}")]
    NonExistentPath {
        origin: &'static str,
        path: PathBuf,
    },
}

// @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-001
pub fn set_aico_root<P: AsRef<Path>>(root: P) -> Result<(), PathBuf> {
    GLOBAL_AICO_ROOT.set(normalize_path(root.as_ref()))
}

// @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-001
pub fn aico_root() -> PathBuf {
    GLOBAL_AICO_ROOT
        .get()
        .cloned()
        .unwrap_or_else(|| {
            let exe = std::env::current_exe().unwrap_or_default();
            let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            let env_val = std::env::var_os("AICO_ROOT");
            let env_path = env_val.as_deref().map(Path::new);
            resolve_aico_root(None, env_path, &exe, &cwd).unwrap_or(cwd)
        })
}

/// Normalizes path by resolving `.` and `..` components cleanly without prepending UNC prefixes
pub fn normalize_path<P: AsRef<Path>>(path: P) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.as_ref().components() {
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

/// Returns `<root>/.aico/logs`, ensuring the directory exists on disk.
// @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-4::REQ-007
pub fn logs_dir<P: AsRef<Path>>(root: P) -> PathBuf {
    let p = root.as_ref().join(".aico").join("logs");
    let _ = std::fs::create_dir_all(&p);
    p
}

/// Resolves the canonical AICO workspace root directory.
/// Precedence order:
/// 1. CLI argument `--root <path>`
/// 2. `AICO_ROOT` environment variable
/// 3. Executable-relative path (`<root>/.aico/bin/aico-server.exe` -> `<root>`)
/// 4. Nearest ancestor of current working directory containing a `.aico` folder
/// 5. Current working directory
// @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-001
// @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-008
pub fn resolve_aico_root(
    cli_root: Option<&Path>,
    env_root: Option<&Path>,
    exe_path: &Path,
    cwd: &Path,
) -> Result<PathBuf, RootResolutionError> {
    // 1. CLI argument --root <path>
    if let Some(cli) = cli_root {
        if !cli.exists() {
            return Err(RootResolutionError::NonExistentPath {
                origin: "--root",
                path: cli.to_path_buf(),
            });
        }
        return Ok(normalize_path(cli));
    }

    // 2. AICO_ROOT env var
    if let Some(env) = env_root {
        if !env.exists() {
            return Err(RootResolutionError::NonExistentPath {
                origin: "AICO_ROOT",
                path: env.to_path_buf(),
            });
        }
        return Ok(normalize_path(env));
    }

    // 3. Executable-relative root:
    // Check if exe is in <root>/.aico/bin/aico-server.exe
    if let Some(bin_dir) = exe_path.parent() {
        if bin_dir.file_name().and_then(|n| n.to_str()).map(|s| s.eq_ignore_ascii_case("bin")).unwrap_or(false) {
            if let Some(dot_aico) = bin_dir.parent() {
                if dot_aico.file_name().and_then(|n| n.to_str()).map(|s| s.eq_ignore_ascii_case(".aico")).unwrap_or(false) {
                    if let Some(root) = dot_aico.parent() {
                        if root.exists() {
                            return Ok(normalize_path(root));
                        }
                    }
                }
            }
        }
    }

    // 4. Nearest ancestor of cwd containing `.aico` directory
    let mut curr = Some(cwd);
    while let Some(dir) = curr {
        if dir.join(".aico").is_dir() {
            return Ok(normalize_path(dir));
        }
        curr = dir.parent();
    }

    // 5. Current working directory
    Ok(normalize_path(cwd))
}
