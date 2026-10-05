pub mod annotation;
pub mod ears;
pub mod server;
pub mod gate;
pub mod traceability;

pub use annotation::{Annotation, AnnotationExtractor, AnnotationKind};
pub use ears::{EarsValidationError, EarsValidator};
pub use server::{McpServerManager, ToolDefinition, ToolError};
pub use gate::{ArtifactToolGate, CreateArtifactParams, GateError};
pub use traceability::{TraceabilityTracker, TraceabilityError, VerificationStatus, VerificationReport, DanglingRequirement};


