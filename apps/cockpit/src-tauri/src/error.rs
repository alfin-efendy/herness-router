use serde::Serialize;
use specta::Type;

#[derive(Debug, Serialize, Type)]
pub struct CmdError {
    pub message: String,
}

// Blanket `impl<E: Display> From<E> for CmdError` conflicts with std's reflexive
// `From<T> for T`. Using explicit impls for every error type used in commands.

impl From<anyhow::Error> for CmdError {
    fn from(e: anyhow::Error) -> Self {
        CmdError {
            message: e.to_string(),
        }
    }
}

impl From<std::io::Error> for CmdError {
    fn from(e: std::io::Error) -> Self {
        CmdError {
            message: e.to_string(),
        }
    }
}
