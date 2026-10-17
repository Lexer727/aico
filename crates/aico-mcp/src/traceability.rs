use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum TraceabilityError {
    #[error("TestBeforeCodeViolation: Requirement '{0}' has no verifying test")]
    NoVerifyingTest(String),
    #[error("TestBeforeCodeViolation: Test for requirement '{0}' is failing (RED)")]
    TestFailing(String),
    #[error("TestBeforeCodeViolation: Requirement '{0}' has no implementing code symbol")]
    NoImplementation(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerificationStatus {
    Passed,
    Failed,
    Pending,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationReport {
    pub task_id: String,
    pub requirement_id: String,
    pub status: String,
    pub verified_by_tests: Vec<String>,
    pub implemented_by_symbols: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DanglingRequirement {
    pub requirement_id: String,
    pub has_test: bool,
    pub has_implementation: bool,
}

#[derive(Default)]
pub struct TraceabilityTracker {
    requirements: HashSet<String>,
    verifies_edges: HashMap<String, Vec<(String, VerificationStatus)>>,
    implements_edges: HashMap<String, Vec<String>>,
}

impl TraceabilityTracker {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_requirement(&mut self, req_id: &str) {
        self.requirements.insert(req_id.to_string());
    }

    /// Record a (Test)-[:VERIFIES]->(Requirement) edge with status
    // @implements ft-core-mcp-tools::TASK-CORE-005-4::REQ-006
    pub fn record_verifies_edge(&mut self, test_name: &str, req_id: &str, status: VerificationStatus) {
        self.requirements.insert(req_id.to_string());
        let list = self.verifies_edges.entry(req_id.to_string()).or_default();
        if let Some(pos) = list.iter().position(|(t, _)| t == test_name) {
            list[pos] = (test_name.to_string(), status);
        } else {
            list.push((test_name.to_string(), status));
        }
    }

    /// Record a (CodeSymbol)-[:IMPLEMENTS]->(Requirement) edge
    // @implements ft-core-mcp-tools::TASK-CORE-005-4::REQ-007
    pub fn record_implements_edge(&mut self, symbol_name: &str, req_id: &str) {
        self.requirements.insert(req_id.to_string());
        let list = self.implements_edges.entry(req_id.to_string()).or_default();
        if !list.contains(&symbol_name.to_string()) {
            list.push(symbol_name.to_string());
        }
    }

    /// Verify test-before-code gate before marking an implementation task complete
    // @implements ft-core-mcp-tools::TASK-CORE-005-4::REQ-006
    // @implements ft-core-mcp-tools::TASK-CORE-005-4::REQ-007
    pub fn verify_task(&self, task_id: &str, req_id: &str) -> Result<VerificationReport, TraceabilityError> {
        let tests = self.verifies_edges.get(req_id).ok_or_else(|| {
            TraceabilityError::NoVerifyingTest(req_id.to_string())
        })?;

        if tests.is_empty() {
            return Err(TraceabilityError::NoVerifyingTest(req_id.to_string()));
        }

        let has_passed = tests.iter().any(|(_, status)| *status == VerificationStatus::Passed);
        if !has_passed {
            return Err(TraceabilityError::TestFailing(req_id.to_string()));
        }

        let impls = self.implements_edges.get(req_id).ok_or_else(|| {
            TraceabilityError::NoImplementation(req_id.to_string())
        })?;

        if impls.is_empty() {
            return Err(TraceabilityError::NoImplementation(req_id.to_string()));
        }

        Ok(VerificationReport {
            task_id: task_id.to_string(),
            requirement_id: req_id.to_string(),
            status: "verified".to_string(),
            verified_by_tests: tests.iter().map(|(t, _)| t.clone()).collect(),
            implemented_by_symbols: impls.clone(),
        })
    }

    /// Find dangling requirements (missing either tests or implementation)
    // @implements ft-core-mcp-tools::TASK-CORE-005-4::REQ-006
    pub fn find_dangling_requirements(&self) -> Vec<DanglingRequirement> {
        let mut results = Vec::new();
        for req in &self.requirements {
            let has_test = self.verifies_edges.get(req).map(|l| !l.is_empty()).unwrap_or(false);
            let has_impl = self.implements_edges.get(req).map(|l| !l.is_empty()).unwrap_or(false);
            if !has_test || !has_impl {
                results.push(DanglingRequirement {
                    requirement_id: req.clone(),
                    has_test,
                    has_implementation: has_impl,
                });
            }
        }
        results.sort_by(|a, b| a.requirement_id.cmp(&b.requirement_id));
        results
    }
}
