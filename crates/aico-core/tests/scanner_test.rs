use aico_core::{RootScanner, WorkspaceRegistry, ProjectManifest, DiscoveredProject};
use std::fs;
use std::path::PathBuf;

// @verifies ft-core-discovery::TASK-CORE-004-2::REQ-001
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-1::REQ-001
#[test]
fn test_root_scanner_discovers_specs_and_codebases() {
    let temp_root = std::env::temp_dir().join(format!("aico_test_root_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let project_specs = temp_root.join("alpha-specs");
    let codebase_dir = temp_root.join("codebase").join("alpha");

    fs::create_dir_all(&project_specs).unwrap();
    fs::create_dir_all(&codebase_dir).unwrap();

    let manifest_content = r#"{
        "name": "alpha",
        "version": "0.1.0",
        "codebase_path": "../codebase/alpha"
    }"#;
    fs::write(project_specs.join(".aico-project.json"), manifest_content).unwrap();

    let discovered = RootScanner::scan(&temp_root).expect("Scanner should discover projects");
    assert_eq!(discovered.len(), 1, "Should discover exactly 1 project");
    assert_eq!(discovered[0].id, "alpha-specs", "Project ID should canonicalize to *-specs folder name");
    assert_eq!(discovered[0].name, "alpha");
    assert_eq!(discovered[0].specs_path, project_specs);
    assert_eq!(discovered[0].codebase_path, Some(codebase_dir));

    // Cleanup
    let _ = fs::remove_dir_all(temp_root);
}

// @verifies spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-1::REQ-001
// @verifies spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-1::REQ-002
// @verifies spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-2::REQ-004
#[test]
fn test_root_scanner_discovers_nested_specs_and_codebases() {
    let temp_root = std::env::temp_dir().join(format!(
        "aico_test_nested_specs_{}",
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    let nested_specs = temp_root.join("specs").join("beta-specs");
    let codebase_dir = temp_root.join("codebase").join("beta");

    fs::create_dir_all(&nested_specs).unwrap();
    fs::create_dir_all(&codebase_dir).unwrap();

    let manifest_content = r#"{
        "project_name": "beta",
        "id": "beta-specs",
        "name": "Beta Specs",
        "repositories": [
            {
                "id": "beta",
                "name": "Beta Codebase",
                "path": "../../codebase/beta",
                "type": "codebase"
            }
        ]
    }"#;
    fs::write(nested_specs.join(".aico-project.json"), manifest_content).unwrap();

    let discovered = RootScanner::scan(&temp_root).expect("Scanner should discover nested specs");
    assert_eq!(discovered.len(), 1, "Should discover 1 project in specs/");
    assert_eq!(discovered[0].id, "beta-specs");
    assert_eq!(discovered[0].name, "Beta Specs");
    assert_eq!(discovered[0].specs_path, nested_specs);
    assert_eq!(discovered[0].codebase_path, Some(codebase_dir));

    let _ = fs::remove_dir_all(temp_root);
}

// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-19::REQ-027
#[test]
fn test_root_scanner_preserves_display_name_from_elevated_manifest() {
    let temp_root = std::env::temp_dir().join(format!(
        "aico_test_display_name_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let project_specs = temp_root.join("aico-specs");
    fs::create_dir_all(&project_specs).unwrap();

    let manifest_content = r#"{
        "project_name": "aico",
        "id": "aico-specs",
        "name": "AICO Specs",
        "url": "https://github.com/Lexer727/aico-specs",
        "repositories": [
            {
                "id": "aico",
                "name": "AICO Engine & WebUI",
                "path": "../codebase/aico",
                "type": "codebase",
                "url": "https://github.com/Lexer727/aico"
            }
        ]
    }"#;
    fs::write(project_specs.join(".aico-project.json"), manifest_content).unwrap();

    let discovered = RootScanner::scan(&temp_root).expect("Scanner should discover project");
    assert_eq!(discovered.len(), 1);
    assert_eq!(discovered[0].id, "aico-specs");
    assert_eq!(discovered[0].name, "AICO Specs");
    assert_eq!(discovered[0].manifest.name, "aico");

    let _ = fs::remove_dir_all(temp_root);
}

// @verifies ft-core-discovery::TASK-CORE-004-2::REQ-005
#[test]
fn test_workspace_registry_tracks_active_project() {
    let mut registry = WorkspaceRegistry::new();

    let project = DiscoveredProject {
        id: "alpha".to_string(),
        name: "alpha".to_string(),
        specs_path: PathBuf::from("d:/aico/alpha-specs"),
        codebase_path: Some(PathBuf::from("d:/aico/codebase/alpha")),
        manifest: ProjectManifest {
            name: "alpha".to_string(),
            id: Some("alpha-specs".to_string()),
            version: Some("0.1.0".to_string()),
            codebase_path: Some("../codebase/alpha".to_string()),
            created_at: None,
            repositories: None,
        },
        status: aico_core::ProjectStatus::Active,
    };

    registry.register(project.clone());
    assert_eq!(registry.list().len(), 1);

    let activated = registry.set_active("alpha");
    assert!(activated, "Setting existing project active should return true");

    let active = registry.get_active().expect("Active project should be set");
    assert_eq!(active.id, "alpha");
}

// @verifies ft-core-skills-sync::TASK-SYNC-002::REQ-001
// @verifies ft-core-skills-sync::TASK-SYNC-002::REQ-002
// @verifies ft-core-skills-sync::TASK-SYNC-002::REQ-003
// @verifies ft-core-skills-sync::TASK-SYNC-002::REQ-004
// @verifies ft-core-skills-sync::TASK-SYNC-003::REQ-005
// @verifies ft-core-skills-sync::TASK-SYNC-003::REQ-006
// @verifies ft-core-skills-sync::TASK-SYNC-003::REQ-008
#[test]
fn test_skills_synchronizer_updates_skills_rules_and_prunes_stale_entries() {
    use aico_core::SkillsSynchronizer;

    let temp_root = std::env::temp_dir().join(format!(
        "aico_skills_sync_test_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    let submodule_skills = temp_root.join("codebase").join("aico").join("skills");
    let skill_start = submodule_skills.join("aico-start");
    let skill_verify_scripts = submodule_skills.join("aico-verify").join("scripts");
    let source_scripts = submodule_skills.join("scripts");
    let source_rules = submodule_skills.join("rules");

    fs::create_dir_all(&skill_start).unwrap();
    fs::create_dir_all(&skill_verify_scripts).unwrap();
    fs::create_dir_all(&source_scripts).unwrap();
    fs::create_dir_all(&source_rules).unwrap();

    fs::write(skill_start.join("SKILL.md"), "# AICO Start v0.1.2").unwrap();
    fs::write(
         submodule_skills.join("aico-verify").join("SKILL.md"),
        "# AICO Verify v0.1.2",
    )
    .unwrap();
    fs::write(
        skill_verify_scripts.join("verify-artifacts.mjs"),
        "console.log('verify');",
    )
    .unwrap();
    fs::write(submodule_skills.join("plugin.json"), "{\n  \"name\": \"aico-skills\",\n  \"version\": \"0.1.2\"\n}").unwrap();
    fs::write(submodule_skills.join("mcp_config.json"), "{\n  \"mcpServers\": {\n    \"aico\": {\n      \"url\": \"http://localhost:4242/mcp\"\n    }\n  }\n}").unwrap();
    fs::write(submodule_skills.join("README.md"), "# Skills Catalog").unwrap();
    fs::write(source_scripts.join("get-version.mjs"), "export default '0.1.2';").unwrap();
    fs::write(source_rules.join("GEMINI.md"), "# Canonical 4-Phase GEMINI Rules").unwrap();
    fs::write(source_rules.join("AGENTS.md"), "# Canonical 4-Phase AGENTS Rules").unwrap();

    // Pre-populate stale .agents/skills entries and outdated GEMINI.md
    let agents_skills = temp_root.join(".agents").join("skills");
    let stale_skill = agents_skills.join("aico-obsolete-skill");
    fs::create_dir_all(&stale_skill).unwrap();
    fs::write(stale_skill.join("SKILL.md"), "# Obsolete Skill").unwrap();
    fs::write(agents_skills.join("SKILL.md"), "# Stray root SKILL.md").unwrap();
    fs::write(temp_root.join("GEMINI.md"), "# Old Manual GEMINI Rules").unwrap();

    // First sync: should copy skills, metadata, scripts, rules, and prune stale entries
    let report1 = SkillsSynchronizer::sync_workspace(&temp_root)
        .expect("Workspace skills sync should succeed");
    assert!(report1.files_updated > 0, "First sync should write files");
    assert!(report1.entries_removed >= 2, "Should remove stale skill dir and stray SKILL.md");

    // Verify skills and supporting files
    assert_eq!(
        fs::read_to_string(agents_skills.join("aico-start").join("SKILL.md")).unwrap(),
        "# AICO Start v0.1.2"
    );
    assert_eq!(
        fs::read_to_string(
            agents_skills
                .join("aico-verify")
                .join("scripts")
                .join("verify-artifacts.mjs")
        )
        .unwrap(),
        "console.log('verify');"
    );
    assert_eq!(
        fs::read_to_string(agents_skills.join("plugin.json")).unwrap(),
        "{\n  \"name\": \"aico-skills\",\n  \"version\": \"0.1.2\"\n}"
    );
    assert_eq!(
        fs::read_to_string(agents_skills.join("README.md")).unwrap(),
        "# Skills Catalog"
    );
    assert_eq!(
        fs::read_to_string(agents_skills.join("scripts").join("get-version.mjs")).unwrap(),
        "export default '0.1.2';"
    );
    // @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-6::REQ-014
    assert!(
        temp_root.join(".agents").join("mcp_config.json").is_file(),
        "Workspace root .agents/mcp_config.json should be created"
    );
    assert!(
        agents_skills.join("mcp_config.json").is_file(),
        "Plugin level .agents/skills/mcp_config.json should be created"
    );

    // Verify stale entries pruned
    assert!(!stale_skill.exists(), "Stale aico-* directory should be pruned");
    assert!(
        !agents_skills.join("SKILL.md").exists(),
        "Stray root .agents/skills/SKILL.md should be removed"
    );

    // Verify rule files synced to both <root>/GEMINI.md and <root>/.agents/rules/
    assert_eq!(
        fs::read_to_string(temp_root.join("GEMINI.md")).unwrap(),
        "# Canonical 4-Phase GEMINI Rules"
    );
    assert_eq!(
        fs::read_to_string(temp_root.join(".agents").join("rules").join("GEMINI.md")).unwrap(),
        "# Canonical 4-Phase GEMINI Rules"
    );
    assert_eq!(
        fs::read_to_string(temp_root.join(".agents").join("rules").join("AGENTS.md")).unwrap(),
        "# Canonical 4-Phase AGENTS Rules"
    );

    // Second sync: idempotent content-diff check should result in 0 writes
    let report2 = SkillsSynchronizer::sync_workspace(&temp_root)
        .expect("Second workspace skills sync should succeed");
    assert_eq!(
        report2.files_updated, 0,
        "Second sync with identical content should not rewrite any files"
    );
    assert!(report2.files_unchanged > 0);

    let _ = fs::remove_dir_all(temp_root);
}

// @verifies ft-core-skills-sync::TASK-SYNC-003::REQ-007
#[test]
fn test_skills_synchronizer_graceful_when_submodule_missing() {
    use aico_core::SkillsSynchronizer;

    let temp_root = std::env::temp_dir().join(format!(
        "aico_skills_sync_missing_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let existing_skill = temp_root.join(".agents").join("skills").join("aico-existing");
    fs::create_dir_all(&existing_skill).unwrap();
    fs::write(existing_skill.join("SKILL.md"), "# Keep Me").unwrap();

    let report = SkillsSynchronizer::sync_workspace(&temp_root)
        .expect("Missing submodule should not error out startup");
    assert_eq!(report.files_updated, 0);
    assert!(
        existing_skill.join("SKILL.md").exists(),
        "Existing .agents files must not be deleted when submodule is missing"
    );

    let _ = fs::remove_dir_all(temp_root);
}

// @verifies ft-core-skills-sync::TASK-SYNC-002::REQ-001
// @verifies ft-core-skills-sync::TASK-SYNC-002::REQ-002
// @verifies ft-core-skills-sync::TASK-SYNC-003::REQ-005
// @verifies ft-core-skills-sync::TASK-SYNC-003::REQ-006
// @verifies spec-ft-tooling-skills-integration::TASK-TOOL-003-1::REQ-004
#[test]
fn test_real_aico_workspace_skills_and_rules_sync() {
    use aico_core::SkillsSynchronizer;
    use std::path::Path;

    let root = Path::new("d:/aico");
    if root.join("codebase/aico/skills").exists() {
        let report = SkillsSynchronizer::sync_workspace(root)
            .expect("Real d:/aico workspace sync should succeed");
        assert!(report.skills_synced >= 22, "All 22+ aico-* skills should be synced");
        assert!(root.join(".agents/skills/aico-start/SKILL.md").is_file());
        assert!(root.join(".agents/skills/aico-feature/SKILL.md").is_file());
        assert!(root.join(".agents/skills/aico-verify/SKILL.md").is_file());
        assert!(root.join(".agents/skills/scripts/aico-cli.mjs").is_file());
        assert!(root.join(".agents/skills/plugin.json").is_file() || root.join(".agents/skills/VERSION").is_file());
        assert!(!root.join(".agents/skills/SKILL.md").exists());
        assert!(root.join("GEMINI.md").is_file());
        assert!(root.join(".agents/rules/GEMINI.md").is_file());
        assert!(root.join(".agents/rules/AGENTS.md").is_file());
    }
}


