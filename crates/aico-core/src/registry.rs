use crate::scanner::DiscoveredProject;
use std::collections::HashMap;

#[derive(Default, Debug)]
pub struct WorkspaceRegistry {
    projects: HashMap<String, DiscoveredProject>,
    active_project_id: Option<String>,
}

impl WorkspaceRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a discovered project into the in-memory registry
    // @implements SPEC-CORE-004::REQ-005
    pub fn register(&mut self, project: DiscoveredProject) {
        self.projects.insert(project.id.clone(), project);
    }

    /// Set the currently active project by ID
    // @implements SPEC-CORE-004::REQ-005
    pub fn set_active(&mut self, id: &str) -> bool {
        if self.projects.contains_key(id) {
            self.active_project_id = Some(id.to_string());
            true
        } else {
            false
        }
    }

    /// Get reference to the active project
    // @implements SPEC-CORE-004::REQ-005
    pub fn get_active(&self) -> Option<&DiscoveredProject> {
        self.active_project_id
            .as_ref()
            .and_then(|id| self.projects.get(id))
    }

    /// List all registered projects
    pub fn list(&self) -> Vec<&DiscoveredProject> {
        self.projects.values().collect()
    }

    /// List cloned projects for serialization
    pub fn list_cloned(&self) -> Vec<DiscoveredProject> {
        self.projects.values().cloned().collect()
    }
}
