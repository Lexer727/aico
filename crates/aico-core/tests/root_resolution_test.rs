// @verifies spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-001
// @verifies spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-008
use aico_core::root::{resolve_aico_root, set_aico_root, aico_root, RootResolutionError};
use std::fs;
use std::path::PathBuf;

#[test]
fn test_resolve_aico_root_cli_flag_takes_precedence() {
    let temp = std::env::temp_dir().join(format!("aico_test_cli_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let cli_dir = temp.join("cli_root");
    let env_dir = temp.join("env_root");
    let exe_dir = temp.join("exe_root").join(".aico").join("bin");
    let cwd_dir = temp.join("cwd_root").join("sub");

    fs::create_dir_all(&cli_dir).unwrap();
    fs::create_dir_all(&env_dir).unwrap();
    fs::create_dir_all(&exe_dir).unwrap();
    fs::create_dir_all(&cwd_dir).unwrap();

    let exe_path = exe_dir.join("aico-server.exe");

    let resolved = resolve_aico_root(
        Some(&cli_dir),
        Some(&env_dir),
        &exe_path,
        &cwd_dir,
    ).expect("Should resolve CLI root");

    assert_eq!(resolved, cli_dir);

    let _ = fs::remove_dir_all(&temp);
}

#[test]
fn test_resolve_aico_root_cli_flag_nonexistent_returns_err() {
    let temp = std::env::temp_dir().join(format!("aico_test_cli_err_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let non_existent = temp.join("does_not_exist");
    let exe_path = PathBuf::from("aico-server.exe");
    let cwd = PathBuf::from(".");

    let err = resolve_aico_root(
        Some(&non_existent),
        None,
        &exe_path,
        &cwd,
    ).unwrap_err();

    match err {
        RootResolutionError::NonExistentPath { origin, path } => {
            assert_eq!(origin, "--root");
            assert_eq!(path, non_existent);
        }
    }
}

#[test]
fn test_resolve_aico_root_env_var_precedence() {
    let temp = std::env::temp_dir().join(format!("aico_test_env_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let env_dir = temp.join("env_root");
    let exe_dir = temp.join("exe_root").join(".aico").join("bin");
    let cwd_dir = temp.join("cwd_root").join("sub");

    fs::create_dir_all(&env_dir).unwrap();
    fs::create_dir_all(&exe_dir).unwrap();
    fs::create_dir_all(&cwd_dir).unwrap();

    let exe_path = exe_dir.join("aico-server.exe");

    let resolved = resolve_aico_root(
        None,
        Some(&env_dir),
        &exe_path,
        &cwd_dir,
    ).expect("Should resolve env root");

    assert_eq!(resolved, env_dir);

    let _ = fs::remove_dir_all(&temp);
}

#[test]
fn test_resolve_aico_root_env_var_nonexistent_returns_err() {
    let temp = std::env::temp_dir().join(format!("aico_test_env_err_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let non_existent = temp.join("does_not_exist_env");
    let exe_path = PathBuf::from("aico-server.exe");
    let cwd = PathBuf::from(".");

    let err = resolve_aico_root(
        None,
        Some(&non_existent),
        &exe_path,
        &cwd,
    ).unwrap_err();

    match err {
        RootResolutionError::NonExistentPath { origin, path } => {
            assert_eq!(origin, "AICO_ROOT");
            assert_eq!(path, non_existent);
        }
    }
}

#[test]
fn test_resolve_aico_root_exe_relative() {
    let temp = std::env::temp_dir().join(format!("aico_test_exe_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let exe_root = temp.join("installed_root");
    let exe_dir = exe_root.join(".aico").join("bin");
    let cwd_dir = temp.join("random_cwd");

    fs::create_dir_all(&exe_dir).unwrap();
    fs::create_dir_all(&cwd_dir).unwrap();

    let exe_path = exe_dir.join("aico-server.exe");

    let resolved = resolve_aico_root(
        None,
        None,
        &exe_path,
        &cwd_dir,
    ).expect("Should resolve exe-relative root");

    assert_eq!(resolved, exe_root);

    let _ = fs::remove_dir_all(&temp);
}

#[test]
fn test_resolve_aico_root_cwd_ancestor() {
    let temp = std::env::temp_dir().join(format!("aico_test_cwd_anc_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let ws_root = temp.join("workspace");
    let dot_aico = ws_root.join(".aico");
    let nested_cwd = ws_root.join("codebase").join("aico").join("crates");

    fs::create_dir_all(&dot_aico).unwrap();
    fs::create_dir_all(&nested_cwd).unwrap();

    let exe_path = PathBuf::from("target/debug/aico-server.exe");

    let resolved = resolve_aico_root(
        None,
        None,
        &exe_path,
        &nested_cwd,
    ).expect("Should resolve ancestor root containing .aico");

    assert_eq!(resolved, ws_root);

    let _ = fs::remove_dir_all(&temp);
}

#[test]
fn test_resolve_aico_root_fallback_to_cwd() {
    let dummy_path = PathBuf::from("dummy").join("isolated").join("path");
    let exe_path = PathBuf::from("target").join("debug").join("aico-server.exe");

    let resolved = resolve_aico_root(
        None,
        None,
        &exe_path,
        &dummy_path,
    ).expect("Should fallback to cwd");

    assert_eq!(resolved, dummy_path);
}

// @verifies spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-4::REQ-007
#[test]
fn test_logs_dir_creation() {
    let temp = std::env::temp_dir().join(format!("aico_test_logs_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let logs = aico_core::root::logs_dir(&temp);
    assert!(logs.is_dir());
    assert_eq!(logs, temp.join(".aico").join("logs"));
    let _ = fs::remove_dir_all(&temp);
}

#[test]
fn test_global_aico_root_accessors() {
    let initial = aico_root();
    assert!(!initial.as_os_str().is_empty());
    let _ = set_aico_root(PathBuf::from("test_root"));
}
