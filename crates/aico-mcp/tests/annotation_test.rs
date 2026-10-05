use aico_mcp::{AnnotationExtractor, AnnotationKind, EarsValidator, EarsValidationError};

// @verifies SPEC-CORE-005::REQ-004
#[test]
fn test_extract_verifies_annotations() {
    let source = r#"
// @verifies SPEC-CORE-001::REQ-002
#[test]
fn test_something() {
    // some test code
}
"#;

    let annotations = AnnotationExtractor::extract(source);
    assert_eq!(annotations.len(), 1);
    assert_eq!(annotations[0].kind, AnnotationKind::Verifies);
    assert_eq!(annotations[0].spec_id, "SPEC-CORE-001");
    assert_eq!(annotations[0].req_id, "REQ-002");
    assert_eq!(annotations[0].line_number, 2);
}

// @verifies SPEC-CORE-005::REQ-005
#[test]
fn test_extract_implements_annotations() {
    let source = r#"
// Some doc comment
// @implements SPEC-CORE-004::REQ-001
pub fn scan_projects() {
    // implementation
}
"#;

    let annotations = AnnotationExtractor::extract(source);
    assert_eq!(annotations.len(), 1);
    assert_eq!(annotations[0].kind, AnnotationKind::Implements);
    assert_eq!(annotations[0].spec_id, "SPEC-CORE-004");
    assert_eq!(annotations[0].req_id, "REQ-001");
}

// @verifies SPEC-CORE-005::REQ-003
#[test]
fn test_validate_ears_syntax() {
    // Valid Ubiquitous pattern with modal "shall"
    let valid_ubiquitous = "The host server shall bind to port 4242.";
    assert!(EarsValidator::validate("REQ-001", valid_ubiquitous).is_ok());

    // Valid Event-Driven pattern
    let valid_event = "When a SIGINT signal is received, the host server shall gracefully drain active connections.";
    assert!(EarsValidator::validate("REQ-005", valid_event).is_ok());

    // Invalid missing "shall"
    let invalid_statement = "The host server binds to port 4242.";
    assert_eq!(
        EarsValidator::validate("REQ-001", invalid_statement),
        Err(EarsValidationError::MissingShall)
    );

    // Invalid requirement ID
    let bad_id = "INVALID_ID";
    assert!(matches!(
        EarsValidator::validate(bad_id, valid_ubiquitous),
        Err(EarsValidationError::InvalidRequirementId(_))
    ));
}
