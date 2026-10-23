pub mod annotation;
pub mod ears;
pub mod graph_tools;
pub mod protocol;
pub mod server;
pub mod traceability;

pub use annotation::{Annotation, AnnotationExtractor, AnnotationKind};
pub use ears::{EarsValidationError, EarsValidator};
pub use graph_tools::{GraphToolHandler, HybridToolHandler, LineageSubgraphPayload};
pub use protocol::{handle_json_rpc, JsonRpcError, JsonRpcRequest, JsonRpcResponse};
pub use server::{McpServerManager, ToolDefinition, ToolError};
pub use traceability::{
    DanglingRequirement, TraceabilityError, TraceabilityTracker, VerificationReport, VerificationStatus,
};
