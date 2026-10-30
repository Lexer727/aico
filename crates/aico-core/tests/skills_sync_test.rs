// @verifies spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-2::REQ-003
use aico_core::skills_sync::SkillsSynchronizer;
use std::fs;

#[test]
fn test_resolve_skills_source_prefers_dev_submodule_when_populated() {
    let temp = std::env::temp_dir().join(format!("aico_skills_dev_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let root = temp.join("root");
    let dev_skills = root.join("codebase").join("aico").join("skills");
    let dev_skill_dir = dev_skills.join("test-skill");
    fs::create_dir_all(&dev_skill_dir).unwrap();
    fs::write(dev_skill_dir.join("SKILL.md"), "---\nname: test-skill\n---").unwrap();

    let exe_dir = temp.join("bin");
    let bundled_skills = exe_dir.join("skills");
    let bundled_skill_dir = bundled_skills.join("bundled-skill");
    fs::create_dir_all(&bundled_skill_dir).unwrap();
    fs::write(bundled_skill_dir.join("SKILL.md"), "---\nname: bundled-skill\n---").unwrap();

    let resolved = SkillsSynchronizer::resolve_skills_source(&root, &exe_dir);
    assert_eq!(resolved, Some(dev_skills));

    let _ = fs::remove_dir_all(&temp);
}

#[test]
fn test_resolve_skills_source_falls_back_to_bundled_when_dev_empty_or_missing() {
    let temp = std::env::temp_dir().join(format!("aico_skills_bundled_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let root = temp.join("root");
    // Empty codebase/aico/skills directory (submodule not cloned)
    let dev_skills = root.join("codebase").join("aico").join("skills");
    fs::create_dir_all(&dev_skills).unwrap();

    let exe_dir = temp.join("bin");
    let bundled_skills = exe_dir.join("skills");
    let bundled_skill_dir = bundled_skills.join("bundled-skill");
    fs::create_dir_all(&bundled_skill_dir).unwrap();
    fs::write(bundled_skill_dir.join("SKILL.md"), "---\nname: bundled-skill\n---").unwrap();

    let resolved = SkillsSynchronizer::resolve_skills_source(&root, &exe_dir);
    assert_eq!(resolved, Some(bundled_skills));

    let _ = fs::remove_dir_all(&temp);
}

#[test]
fn test_resolve_skills_source_returns_none_when_neither_has_skills() {
    let temp = std::env::temp_dir().join(format!("aico_skills_none_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let root = temp.join("root");
    let exe_dir = temp.join("bin");
    fs::create_dir_all(&root).unwrap();
    fs::create_dir_all(&exe_dir).unwrap();

    let resolved = SkillsSynchronizer::resolve_skills_source(&root, &exe_dir);
    assert_eq!(resolved, None);

    let _ = fs::remove_dir_all(&temp);
}

#[test]
fn test_sync_workspace_with_bundled_skills() {
    let temp = std::env::temp_dir().join(format!("aico_sync_bundled_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let root = temp.join("user_root");
    let exe_dir = temp.join("install_bin");
    let bundled_skills = exe_dir.join("skills");
    let bundled_skill_dir = bundled_skills.join("aico-start");
    fs::create_dir_all(&bundled_skill_dir).unwrap();
    fs::write(bundled_skill_dir.join("SKILL.md"), "---\nname: aico-start\n---").unwrap();

    let report = SkillsSynchronizer::sync_workspace_with_exe(&root, &exe_dir).expect("Sync should succeed");
    assert_eq!(report.skills_synced, 1);
    assert!(root.join(".agents").join("skills").join("aico-start").join("SKILL.md").exists());

    let _ = fs::remove_dir_all(&temp);
}
