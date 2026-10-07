use aico_server::{GitStatusScanner, GitRepoStatus};

// @verifies spec-ft-git-backend-status::REQ-003
// @verifies spec-ft-git-backend-status::REQ-004
#[test]
fn test_git_status_inspection() {
    let sample_output = r#"# branch.oid 93669ebe7886e78484f59449da3efe4d63f9595d
# branch.head main
# branch.upstream origin/main
# branch.ab +3 -1
1 .M N... 100644 100644 100644 bad7e2c0c4368eff013e6dc22b1bcf1381f01a3d bad7e2c0c4368eff013e6dc22b1bcf1381f01a3d crates/aico-core/src/lib.rs
1 M. N... 100644 100644 100644 e18f7b850f8f3cbef5337267d27ab2df204b1406 e18f7b850f8f3cbef5337267d27ab2df204b1406 crates/aico-core/src/manifest.rs
? new_untracked_file.rs
"#;

    let parsed: GitRepoStatus = GitStatusScanner::parse_porcelain_v2(sample_output);

    assert_eq!(parsed.branch, Some("main".to_string()));
    assert_eq!(parsed.upstream, Some("origin/main".to_string()));
    assert_eq!(parsed.ahead, 3);
    assert_eq!(parsed.behind, 1);
    assert_eq!(parsed.staged_count, 1);
    assert_eq!(parsed.unstaged_count, 1);
    assert_eq!(parsed.untracked_count, 1);
    assert!(!parsed.is_clean, "Working tree with modifications and untracked files must not be clean");

    // Clean branch parsing
    let clean_output = r#"# branch.oid deadbeef
# branch.head feature/branch
# branch.upstream origin/feature/branch
# branch.ab +0 -0
"#;
    let clean_parsed = GitStatusScanner::parse_porcelain_v2(clean_output);
    assert_eq!(clean_parsed.branch, Some("feature/branch".to_string()));
    assert_eq!(clean_parsed.ahead, 0);
    assert_eq!(clean_parsed.behind, 0);
    assert!(clean_parsed.is_clean);
}

// @verifies spec-ft-git-backend-status::REQ-006
#[tokio::test]
async fn test_git_status_scanner_missing_path() {
    let status = GitStatusScanner::scan_repo(
        "missing-repo",
        "Missing Repository",
        "d:/non_existent_directory_for_git_testing_xyz_123",
        "codebase"
    ).await;

    assert!(!status.is_available, "Non-existent path must report is_available: false");
    assert!(status.error.is_some());
    assert!(status.error.unwrap().contains("does not exist"));
}
