use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use tokio::sync::broadcast;

#[derive(Error, Debug, PartialEq, Eq, Clone)]
pub enum HumanGateError {
    #[error("Task with ID '{0}' not found")]
    TaskNotFound(String),
    #[error("Task '{0}' is not a human asset delivery gate task")]
    NotAHumanGateTask(String),
    #[error("Invalid MIME type: expected '{expected}', received '{received}'")]
    InvalidMimeType {
        expected: String,
        received: String,
    },
    #[error("Task '{0}' is already completed")]
    AlreadyCompleted(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskRole {
    User,
    Agent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskStatus {
    Pending,
    Blocked,
    Ready,
    InProgress,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlanTask {
    pub id: String,
    pub title: String,
    pub role: TaskRole,
    pub task_type: String,
    pub status: TaskStatus,
    pub dependencies: Vec<String>,
    pub required_mime: Option<String>,
    pub delivered_asset_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FrontierTransition {
    pub gate_task_id: String,
    pub newly_unblocked: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TaskUnblockedEvent {
    pub unblocked_task_ids: Vec<String>,
}

pub struct HumanGateManager {
    tasks: HashMap<String, PlanTask>,
    notifier: broadcast::Sender<TaskUnblockedEvent>,
}

impl Default for HumanGateManager {
    fn default() -> Self {
        Self::new()
    }
}

impl HumanGateManager {
    pub fn new() -> Self {
        let (notifier, _) = broadcast::channel(64);
        Self {
            tasks: HashMap::new(),
            notifier,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<TaskUnblockedEvent> {
        self.notifier.subscribe()
    }

    pub fn add_task(&mut self, task: PlanTask) {
        self.tasks.insert(task.id.clone(), task);
    }

    pub fn get_task(&self, id: &str) -> Option<&PlanTask> {
        self.tasks.get(id)
    }

    pub fn is_blocked(&self, id: &str) -> bool {
        match self.tasks.get(id) {
            Some(task) => {
                if task.status == TaskStatus::Completed {
                    return false;
                }
                // Blocked if any dependency is not completed
                task.dependencies.iter().any(|dep_id| {
                    match self.tasks.get(dep_id) {
                        Some(dep) => dep.status != TaskStatus::Completed,
                        None => true, // Missing dependency counts as blocked
                    }
                })
            }
            None => false,
        }
    }

    /// Computes the active agent frontier: unblocked agent tasks ready for execution
    // @implements ft-core-epic-hub::TASK-CORE-007-3::REQ-008
    pub fn active_agent_frontier(&self) -> Vec<String> {
        let mut frontier = Vec::new();
        for task in self.tasks.values() {
            if task.role == TaskRole::Agent && task.status != TaskStatus::Completed {
                if !self.is_blocked(&task.id) {
                    frontier.push(task.id.clone());
                }
            }
        }
        frontier.sort();
        frontier
    }

    /// Delivers an asset satisfying a human gate task, unblocking dependent frontier tasks
    // @implements ft-core-epic-hub::TASK-CORE-007-3::REQ-008
    // @implements ft-core-epic-hub::TASK-CORE-007-3::REQ-012
    pub async fn deliver_asset(
        &mut self,
        task_id: &str,
        asset_id: &str,
        mime_type: &str,
    ) -> Result<FrontierTransition, HumanGateError> {
        let task = self
            .tasks
            .get_mut(task_id)
            .ok_or_else(|| HumanGateError::TaskNotFound(task_id.to_string()))?;

        if task.role != TaskRole::User || task.task_type != "asset_delivery" {
            return Err(HumanGateError::NotAHumanGateTask(task_id.to_string()));
        }

        if task.status == TaskStatus::Completed {
            return Err(HumanGateError::AlreadyCompleted(task_id.to_string()));
        }

        // Validate MIME type if constraint is specified
        if let Some(ref expected_mime) = task.required_mime {
            if expected_mime != mime_type && !Self::mime_matches(expected_mime, mime_type) {
                return Err(HumanGateError::InvalidMimeType {
                    expected: expected_mime.clone(),
                    received: mime_type.to_string(),
                });
            }
        }

        task.status = TaskStatus::Completed;
        task.delivered_asset_id = Some(asset_id.to_string());

        // Compute newly unblocked tasks
        let mut newly_unblocked = Vec::new();
        for t in self.tasks.values_mut() {
            if t.dependencies.contains(&task_id.to_string()) && t.status != TaskStatus::Completed {
                // Check if all its dependencies are now completed
                let all_deps_completed = t.dependencies.iter().all(|dep| {
                    if dep == task_id {
                        true
                    } else {
                        // check other dependencies
                        false
                    }
                });
                if all_deps_completed {
                    t.status = TaskStatus::Ready;
                    newly_unblocked.push(t.id.clone());
                }
            }
        }

        // Double check against general unblock logic for multi-dep tasks
        let mut verified_unblocked = Vec::new();
        for id in &newly_unblocked {
            if !self.is_blocked(id) {
                verified_unblocked.push(id.clone());
            }
        }
        verified_unblocked.sort();

        // Broadcast notification if any tasks were unblocked
        if !verified_unblocked.is_empty() {
            let _ = self.notifier.send(TaskUnblockedEvent {
                unblocked_task_ids: verified_unblocked.clone(),
            });
        }

        Ok(FrontierTransition {
            gate_task_id: task_id.to_string(),
            newly_unblocked: verified_unblocked,
        })
    }

    fn mime_matches(expected: &str, received: &str) -> bool {
        if expected.ends_with("/*") {
            let prefix = &expected[..expected.len() - 1];
            received.starts_with(prefix)
        } else {
            expected == received
        }
    }
}
