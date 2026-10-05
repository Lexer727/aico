pub mod policy;
pub mod executor;
pub mod audit;
pub mod gate;
pub mod killswitch;

pub use policy::{PolicyEngine, CommandTier, PolicyDecision, AutoModeState};
pub use executor::{CommandExecutor, ExecutionOutput, ExecutionError};
pub use audit::{AuditLogger, AuditEvent, AuditError};
pub use gate::{ApprovalGateManager, ApprovalError, GateRequest};
pub use killswitch::EmergencyKillSwitch;



