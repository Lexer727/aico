use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnnotationKind {
    Verifies,
    Implements,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Annotation {
    pub kind: AnnotationKind,
    pub spec_id: String,
    pub req_id: String,
    pub line_number: usize,
}

pub struct AnnotationExtractor;

impl AnnotationExtractor {
    /// Extracts all `// @verifies` and `// @implements` tags from source code content
    // @implements SPEC-CORE-005::REQ-004
    // @implements SPEC-CORE-005::REQ-005
    pub fn extract(source: &str) -> Vec<Annotation> {
        let verifies_re = Regex::new(r"//\s*@verifies\s+([A-Za-z0-9\-_]+)::([A-Za-z0-9\-_]+)").unwrap();
        let implements_re = Regex::new(r"//\s*@implements\s+([A-Za-z0-9\-_]+)::([A-Za-z0-9\-_]+)").unwrap();

        let mut annotations = Vec::new();

        for (idx, line) in source.lines().enumerate() {
            let line_num = idx + 1;

            if let Some(caps) = verifies_re.captures(line) {
                annotations.push(Annotation {
                    kind: AnnotationKind::Verifies,
                    spec_id: caps[1].to_string(),
                    req_id: caps[2].to_string(),
                    line_number: line_num,
                });
            } else if let Some(caps) = implements_re.captures(line) {
                annotations.push(Annotation {
                    kind: AnnotationKind::Implements,
                    spec_id: caps[1].to_string(),
                    req_id: caps[2].to_string(),
                    line_number: line_num,
                });
            }
        }

        annotations
    }
}
