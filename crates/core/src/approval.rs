use crate::domain::CoreEvent;
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

pub struct ApprovalHub {
    pending: Mutex<HashMap<String, oneshot::Sender<bool>>>,
}

impl ApprovalHub {
    pub fn new() -> ApprovalHub {
        ApprovalHub {
            pending: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(&self, request_id: String) -> oneshot::Receiver<bool> {
        let (tx, rx) = oneshot::channel();
        self.pending.lock().unwrap().insert(request_id, tx);
        rx
    }

    /// Returns true if a pending request with this id existed.
    pub fn resolve(&self, request_id: &str, allow: bool) -> bool {
        if let Some(tx) = self.pending.lock().unwrap().remove(request_id) {
            let _ = tx.send(allow);
            true
        } else {
            false
        }
    }

    /// Returns `true` if the hub currently has any unresolved registrations.
    /// Useful in tests to assert that the bridge never registered a request
    /// (i.e. auto-allow short-circuited before the hub).
    pub fn has_pending(&self) -> bool {
        !self.pending.lock().unwrap().is_empty()
    }
}

impl Default for ApprovalHub {
    fn default() -> Self {
        Self::new()
    }
}

/// Implemented by `ControlPlane`: resolves a tool request to allow/deny.
pub trait ApprovalDecider: Send + Sync + 'static {
    fn decide(
        &self,
        session_pk: String,
        tool: String,
        input: serde_json::Value,
    ) -> Pin<Box<dyn std::future::Future<Output = bool> + Send + '_>>;
}

/// Loopback HTTP server: the `hook` binary POSTs here; we forward to the decider.
pub struct ApprovalServer {
    url: String,
    shutdown: Option<std::thread::JoinHandle<()>>,
    server: Arc<tiny_http::Server>,
}

#[derive(serde::Deserialize)]
struct ApproveBody {
    #[serde(rename = "sessionPk")]
    session_pk: String,
    tool: String,
    input: serde_json::Value,
}

impl ApprovalServer {
    pub fn start(
        handle: tokio::runtime::Handle,
        decider: Arc<dyn ApprovalDecider>,
    ) -> std::io::Result<ApprovalServer> {
        let token = crate::paths::new_id();
        let server = Arc::new(
            tiny_http::Server::http("127.0.0.1:0")
                .map_err(|e| std::io::Error::other(e.to_string()))?,
        );
        let port = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(0);
        let url = format!("http://127.0.0.1:{port}/{token}");

        let path = format!("/{token}");
        let srv = server.clone();
        let join = std::thread::spawn(move || {
            for mut request in srv.incoming_requests() {
                if request.method() != &tiny_http::Method::Post || request.url() != path {
                    let _ = request.respond(tiny_http::Response::empty(403));
                    continue;
                }
                let mut body = String::new();
                let _ = request.as_reader().read_to_string(&mut body);
                let decision = match serde_json::from_str::<ApproveBody>(&body) {
                    Ok(b) => handle.block_on(decider.decide(b.session_pk, b.tool, b.input)),
                    Err(_) => false,
                };
                let payload = serde_json::json!({
                    "permissionDecision": if decision { "allow" } else { "deny" }
                })
                .to_string();
                let resp = tiny_http::Response::from_string(payload).with_header(
                    "Content-Type: application/json"
                        .parse::<tiny_http::Header>()
                        .unwrap(),
                );
                let _ = request.respond(resp);
            }
        });

        Ok(ApprovalServer {
            url,
            shutdown: Some(join),
            server,
        })
    }

    pub fn url(&self) -> &str {
        &self.url
    }
}

impl Drop for ApprovalServer {
    fn drop(&mut self) {
        self.server.unblock();
        if let Some(join) = self.shutdown.take() {
            let _ = join.join();
        }
    }
}

// Re-export so ControlPlane can publish events alongside approvals.
pub type Events = tokio::sync::broadcast::Sender<CoreEvent>;

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn register_then_resolve_completes_the_receiver() {
        let hub = ApprovalHub::new();
        let rx = hub.register("req-1".into());
        assert!(hub.resolve("req-1", true));
        assert!(rx.await.unwrap());
        // resolving an unknown id returns false
        assert!(!hub.resolve("nope", true));
    }
}
