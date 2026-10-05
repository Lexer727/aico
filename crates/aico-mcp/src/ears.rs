use thiserror::Error;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum EarsValidationError {
    #[error("Missing modal keyword 'shall'")]
    MissingShall,
    #[error("Invalid requirement ID format '{0}': expected REQ-### format")]
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
    // @implements SPEC-CORE-005::REQ-003
    pub fn validate(req_id: &str, statement: &str) -> Result<EarsPattern, EarsValidationError> {
        // Validate requirement ID format (e.g. REQ-001)
        if !req_id.starts_with("REQ-") || req_id.len() < 5 || !req_id[4..].chars().all(|c| c.is_ascii_digit()) {
            return Err(EarsValidationError::InvalidRequirementId(req_id.to_string()));
        }

        let trimmed = statement.trim();
        if trimmed.is_empty() {
            return Err(EarsValidationError::EmptyRequirement);
        }

        // Modal "shall" is mandatory in all EARS clauses
        let contains_shall = trimmed
            .split_whitespace()
            .any(|w| w.eq_ignore_ascii_case("shall"));

        if !contains_shall {
            return Err(EarsValidationError::MissingShall);
        }

        // Classify the pattern
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
