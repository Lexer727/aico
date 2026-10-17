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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
    pub req_id: String,
    pub line_number: usize,
}

pub struct AnnotationExtractor;

impl AnnotationExtractor {
    /// Extracts all `// @verifies` and `// @implements` tags from source code content
    // @implements ft-core-mcp-tools::TASK-CORE-005-1::REQ-004
    // @implements ft-core-mcp-tools::TASK-CORE-005-1::REQ-005
    pub fn extract(source: &str) -> Vec<Annotation> {
        let verifies_3_re = Regex::new(r"(?://|#|/\*|\{/\*)\s*@verifies\s+([A-Za-z0-9\-_]+)::(TASK-[A-Za-z0-9\-_]+)::(REQ-[0-9]{3,4})").unwrap();
        let implements_3_re = Regex::new(r"(?://|#|/\*|\{/\*)\s*@implements\s+([A-Za-z0-9\-_]+)::(TASK-[A-Za-z0-9\-_]+)::(REQ-[0-9]{3,4})").unwrap();

        let verifies_2_re = Regex::new(r"(?://|#|/\*|\{/\*)\s*@verifies\s+([A-Za-z0-9\-_]+)::(REQ-[0-9]{3,4})").unwrap();
        let implements_2_re = Regex::new(r"(?://|#|/\*|\{/\*)\s*@implements\s+([A-Za-z0-9\-_]+)::(REQ-[0-9]{3,4})").unwrap();

        let mut annotations = Vec::new();

        for (idx, line) in source.lines().enumerate() {
            if line.contains('<') || line.contains('>') || line.contains("###") {
                continue;
            }

            let line_num = idx + 1;

            if let Some(caps) = verifies_3_re.captures(line) {
                annotations.push(Annotation {
                    kind: AnnotationKind::Verifies,
                    spec_id: caps[1].to_string(),
                    task_id: Some(caps[2].to_string()),
                    req_id: caps[3].to_string(),
                    line_number: line_num,
                });
            } else if let Some(caps) = implements_3_re.captures(line) {
                annotations.push(Annotation {
                    kind: AnnotationKind::Implements,
                    spec_id: caps[1].to_string(),
                    task_id: Some(caps[2].to_string()),
                    req_id: caps[3].to_string(),
                    line_number: line_num,
                });
            } else if let Some(caps) = verifies_2_re.captures(line) {
                annotations.push(Annotation {
                    kind: AnnotationKind::Verifies,
                    spec_id: caps[1].to_string(),
                    task_id: None,
                    req_id: caps[2].to_string(),
                    line_number: line_num,
                });
            } else if let Some(caps) = implements_2_re.captures(line) {
                annotations.push(Annotation {
                    kind: AnnotationKind::Implements,
                    spec_id: caps[1].to_string(),
                    task_id: None,
                    req_id: caps[2].to_string(),
                    line_number: line_num,
                });
            }
        }

        annotations
    }
}
