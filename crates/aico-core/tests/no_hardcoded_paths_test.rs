// @verifies spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-1::REQ-002
use std::fs;
use std::path::{Path, PathBuf};

fn check_dir_for_hardcoded_paths(dir: &Path, violations: &mut Vec<String>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                check_dir_for_hardcoded_paths(&path, violations);
            } else if path.extension().and_then(|s| s.to_str()) == Some("rs") {
                if let Ok(content) = fs::read_to_string(&path) {
                    for (line_idx, line) in content.lines().enumerate() {
                        let lower = line.to_lowercase();
                        // Look for "d:/aico" or "d:\\aico" literals
                        if (lower.contains("\"d:/aico") || lower.contains("\"d:\\\\aico") || lower.contains("d:/aico/aico-specs"))
                            && !line.trim_start().starts_with("//") {
                            violations.push(format!("{}:{}: {}", path.display(), line_idx + 1, line.trim()));
                        }
                    }
                }
            }
        }
    }
}

#[test]
fn test_no_hardcoded_workspace_paths_in_crates() {
    let mut violations = Vec::new();
    let crates_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();

    for crate_entry in fs::read_dir(&crates_dir).unwrap().flatten() {
        let src_dir = crate_entry.path().join("src");
        if src_dir.is_dir() {
            check_dir_for_hardcoded_paths(&src_dir, &mut violations);
        }
    }

    assert!(
        violations.is_empty(),
        "Found hardcoded absolute workspace paths in runtime crates:\n{}",
        violations.join("\n")
    );
}
