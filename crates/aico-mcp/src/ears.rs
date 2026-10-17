use regex::Regex;
use thiserror::Error;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum EarsValidationError {
    #[error("Missing modal keyword 'shall'")]
    MissingShall,
    #[error("Invalid requirement ID format '{0}': expected REQ-### or REQ-<DOMAIN>-### format")]
    InvalidRequirementId(String),
    #[error("Empty requirement text")]
    EmptyRequirement,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EarsPattern {
    Ubiquitous,  // The <system> shall <action>
    EventDriven, // When <trigger> the <system> shall <action>
    StateDriven, // While <precondition> the <system> shall <action>
    Optional,    // Where <feature> the <system> shall <action>
    Unwanted,    // If <trigger> then the <system> shall <action>
}

pub struct EarsValidator;

impl EarsValidator {
    /// Validates an EARS requirement statement syntax
    // @implements ft-core-mcp-tools::TASK-CORE-005-1::REQ-003
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-1::REQ-003
    pub fn validate(req_id: &str, statement: &str) -> Result<EarsPattern, EarsValidationError> {
        let req_id_re = Regex::new(r"^REQ(?:-[A-Za-z0-9]+)?-\d{3,4}$").unwrap();
        if !req_id_re.is_match(req_id) {
            return Err(EarsValidationError::InvalidRequirementId(req_id.to_string()));
        }

        let trimmed = statement.trim();
        if trimmed.is_empty() {
            return Err(EarsValidationError::EmptyRequirement);
        }

        let contains_shall = trimmed
            .split_whitespace()
            .any(|w| w.eq_ignore_ascii_case("shall"));

        if !contains_shall {
            return Err(EarsValidationError::MissingShall);
        }

        let lower = trimmed.to_lowercase();
        let pattern = if lower.starts_with("when ") {
            EarsPattern::EventDriven
        } else if lower.starts_with("while ") {
            EarsPattern::StateDriven
        } else if lower.starts_with("where ") {
            EarsPattern::Optional
        } else if lower.starts_with("if ") {
            EarsPattern::Unwanted
        } else {
            EarsPattern::Ubiquitous
        };

        Ok(pattern)
    }
}
