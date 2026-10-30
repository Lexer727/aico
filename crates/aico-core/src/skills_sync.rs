use std::collections::HashSet;
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SkillsSyncError {
    #[error("I/O error during skills synchronization: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SyncReport {
    pub skills_synced: usize,
    pub files_updated: usize,
    pub files_unchanged: usize,
    pub entries_removed: usize,
}

pub struct SkillsSynchronizer;

impl SkillsSynchronizer {
    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-2::REQ-003
    pub fn resolve_skills_source<P: AsRef<Path>, Q: AsRef<Path>>(
        root: P,
        exe_dir: Q,
    ) -> Option<std::path::PathBuf> {
        let root = root.as_ref();
        let dev_source = root.join("codebase").join("aico").join("skills");
        if dev_source.is_dir() {
            if let Ok(entries) = fs::read_dir(&dev_source) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() && path.join("SKILL.md").is_file() {
                        return Some(dev_source);
                    }
                }
            }
        }

        let bundled = exe_dir.as_ref().join("skills");
        if bundled.is_dir() {
            if let Ok(entries) = fs::read_dir(&bundled) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() && path.join("SKILL.md").is_file() {
                        return Some(bundled);
                    }
                }
            }
        }

        None
    }

    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-2::REQ-003
    pub fn sync_workspace_with_exe<P: AsRef<Path>, Q: AsRef<Path>>(
        root_dir: P,
        exe_dir: Q,
    ) -> Result<SyncReport, SkillsSyncError> {
        let root = root_dir.as_ref();
        if let Some(source) = Self::resolve_skills_source(root, exe_dir) {
            Self::sync_from_source(&source, root)
        } else {
            Ok(SyncReport::default())
        }
    }

    /// Synchronize workspace `.agents/skills/`, `.agents/rules/`, and `GEMINI.md`
    /// from `<root_dir>/codebase/aico/skills` or bundled `<exe_dir>/skills`.
    // @implements ft-core-skills-sync::TASK-SYNC-002::REQ-001
    // @implements spec-ft-distribution-portable-runtime-root::TASK-DISTRIBUTION-001-2::REQ-003
    pub fn sync_workspace<P: AsRef<Path>>(root_dir: P) -> Result<SyncReport, SkillsSyncError> {
        let root = root_dir.as_ref();
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|e| e.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        Self::sync_workspace_with_exe(root, exe_dir)
    }

    /// Synchronize workspace skills and rules from an explicit skills source directory.
    // @implements ft-core-skills-sync::TASK-SYNC-002::REQ-002
    // @implements ft-core-skills-sync::TASK-SYNC-002::REQ-003
    // @implements ft-core-skills-sync::TASK-SYNC-002::REQ-004
    // @implements ft-core-skills-sync::TASK-SYNC-003::REQ-005
    // @implements ft-core-skills-sync::TASK-SYNC-003::REQ-006
    // @implements ft-core-skills-sync::TASK-SYNC-003::REQ-007
    // @implements ft-core-skills-sync::TASK-SYNC-003::REQ-008
    // @implements spec-ft-tooling-skills-integration::TASK-TOOL-003-1::REQ-004
    pub fn sync_from_source<P: AsRef<Path>, Q: AsRef<Path>>(
        source_skills_dir: P,
        root_dir: Q,
    ) -> Result<SyncReport, SkillsSyncError> {
        let src_dir = source_skills_dir.as_ref();
        let root = root_dir.as_ref();
        let mut report = SyncReport::default();

        if !src_dir.exists() || !src_dir.is_dir() {
            return Ok(report);
        }

        // Discover all valid skill directories (subdirectories containing SKILL.md)
        let mut skill_dirs = Vec::new();
        let mut valid_skill_names = HashSet::new();

        for entry in fs::read_dir(src_dir)?.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("SKILL.md").is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    valid_skill_names.insert(name.to_string());
                    skill_dirs.push((name.to_string(), path));
                }
            }
        }

        // REQ-007: If submodule is uninitialized / contains no skills, return gracefully
        if skill_dirs.is_empty() {
            return Ok(report);
        }

        let target_agents_skills = root.join(".agents").join("skills");
        fs::create_dir_all(&target_agents_skills)?;

        // REQ-004: Remove stray root .agents/skills/SKILL.md if present
        let stray_root_skill = target_agents_skills.join("SKILL.md");
        if stray_root_skill.is_file() {
            fs::remove_file(&stray_root_skill)?;
            report.entries_removed += 1;
        }

        // REQ-004: Prune stale `aico-*` skill directories in .agents/skills/
        for entry in fs::read_dir(&target_agents_skills)?.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("aico-") && !valid_skill_names.contains(name) {
                        fs::remove_dir_all(&path)?;
                        report.entries_removed += 1;
                    }
                }
            }
        }

        // REQ-002: Synchronize all valid skill directories recursively
        for (skill_name, skill_src_path) in &skill_dirs {
            let skill_dst_path = target_agents_skills.join(skill_name);
            Self::sync_dir_recursive(skill_src_path, &skill_dst_path, &mut report)?;
            report.skills_synced += 1;
        }

        // REQ-003: Synchronize supporting root files (plugin.json, README.md, VERSION, mcp_config.json) and scripts/
        // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-6::REQ-014
        for root_file in ["plugin.json", "README.md", "VERSION", "mcp_config.json"] {
            let src_file = src_dir.join(root_file);
            if src_file.is_file() {
                let dst_file = target_agents_skills.join(root_file);
                Self::sync_file_if_changed(&src_file, &dst_file, &mut report)?;
            }
        }

        // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-6::REQ-014
        let mcp_src = src_dir.join("mcp_config.json");
        if mcp_src.is_file() {
            let target_agents_mcp = root.join(".agents").join("mcp_config.json");
            Self::sync_file_if_changed(&mcp_src, &target_agents_mcp, &mut report)?;
        }

        let src_scripts = src_dir.join("scripts");
        if src_scripts.is_dir() {
            let dst_scripts = target_agents_skills.join("scripts");
            Self::sync_dir_recursive(&src_scripts, &dst_scripts, &mut report)?;
        }

        // REQ-005 & REQ-006: Synchronize rule files (GEMINI.md and AGENTS.md)
        let target_agents_rules = root.join(".agents").join("rules");
        let rules_gemini = src_dir.join("rules").join("GEMINI.md");
        let fallback_gemini = src_dir.join("GEMINI.md");
        let gemini_src = if rules_gemini.is_file() {
            Some(rules_gemini)
        } else if fallback_gemini.is_file() {
            Some(fallback_gemini)
        } else {
            None
        };

        if let Some(src_gemini) = gemini_src {
            fs::create_dir_all(&target_agents_rules)?;
            Self::sync_file_if_changed(&src_gemini, &root.join("GEMINI.md"), &mut report)?;
            Self::sync_file_if_changed(
                &src_gemini,
                &target_agents_rules.join("GEMINI.md"),
                &mut report,
            )?;
        }

        let rules_agents = src_dir.join("rules").join("AGENTS.md");
        if rules_agents.is_file() {
            fs::create_dir_all(&target_agents_rules)?;
            Self::sync_file_if_changed(
                &rules_agents,
                &target_agents_rules.join("AGENTS.md"),
                &mut report,
            )?;
        }

        Ok(report)
    }

    // @implements ft-core-skills-sync::TASK-SYNC-002::REQ-002
    // @implements ft-core-skills-sync::TASK-SYNC-002::REQ-004
    fn sync_dir_recursive(
        src_dir: &Path,
        dst_dir: &Path,
        report: &mut SyncReport,
    ) -> Result<(), SkillsSyncError> {
        fs::create_dir_all(dst_dir)?;

        let mut src_names = HashSet::new();
        for entry in fs::read_dir(src_dir)?.flatten() {
            let src_path = entry.path();
            if let Some(name_os) = src_path.file_name() {
                let name = name_os.to_string_lossy().to_string();
                if name.starts_with('.') {
                    continue;
                }
                src_names.insert(name.clone());
                let dst_path = dst_dir.join(&name);
                if src_path.is_dir() {
                    Self::sync_dir_recursive(&src_path, &dst_path, report)?;
                } else if src_path.is_file() {
                    Self::sync_file_if_changed(&src_path, &dst_path, report)?;
                }
            }
        }

        // Remove any stale files or directories inside dst_dir that are not in src_dir
        for entry in fs::read_dir(dst_dir)?.flatten() {
            let dst_path = entry.path();
            if let Some(name_os) = dst_path.file_name() {
                let name = name_os.to_string_lossy().to_string();
                if !src_names.contains(&name) {
                    if dst_path.is_dir() {
                        fs::remove_dir_all(&dst_path)?;
                    } else {
                        fs::remove_file(&dst_path)?;
                    }
                    report.entries_removed += 1;
                }
            }
        }

        Ok(())
    }

    // @implements ft-core-skills-sync::TASK-SYNC-003::REQ-008
    fn sync_file_if_changed(
        src: &Path,
        dst: &Path,
        report: &mut SyncReport,
    ) -> Result<(), SkillsSyncError> {
        let src_bytes = fs::read(src)?;
        if dst.is_file() {
            if let Ok(dst_bytes) = fs::read(dst) {
                if src_bytes == dst_bytes {
                    report.files_unchanged += 1;
                    return Ok(());
                }
            }
        }
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(dst, &src_bytes)?;
        report.files_updated += 1;
        Ok(())
    }
}
