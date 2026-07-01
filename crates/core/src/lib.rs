pub mod approval;
pub mod control;
pub mod domain;
pub mod harness;
pub mod paths;
pub mod policy;
pub mod registry;
pub mod runtime;
pub mod store;
pub mod worktree;

pub use control::ControlPlane;
pub use domain::{
    AgentEvent, CoreEvent, McpServerSpec, McpTransport, Message, PermMode, Project, Session,
    SessionStatus,
};
pub use harness::{Harness, HarnessFactory, HarnessRegistry, HarnessSession, SessionCtx};
pub use registry::Registry;
pub use store::Store;
