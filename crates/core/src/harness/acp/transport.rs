//! ACP client transport + connection + `initialize`.
//!
//! Task 1 owns the client-side round-trip against the external
//! `agent-client-protocol` 1.0 crate: build a `Client`, connect it over a
//! transport, send `initialize` (advertising **no** fs/terminal in 3A), and
//! read back the agent capabilities we care about (`session/load`,
//! `session/close`).
//!
//! Two seams matter here:
//! - Production spawns the adapter sidecar and builds a `ByteStreams` over its
//!   stdio (see [`spawn_adapter`]). That path is defined but unused in Task 1.
//! - Tests inject a duplex-backed transport from the testkit, so the whole
//!   builder + transport + `initialize` path is exercised without a real
//!   process.
//!
//! Both feed the same [`connect_and_initialize`], which is transport-agnostic
//! over any `impl ConnectTo<Client>`.

use std::sync::Arc;

use agent_client_protocol::schema::v1::{
    ClientCapabilities, InitializeRequest, InitializeResponse, RequestPermissionOutcome,
    RequestPermissionRequest, RequestPermissionResponse, SessionNotification,
};
use agent_client_protocol::schema::ProtocolVersion;
use agent_client_protocol::{Client, ConnectionTo};
use agent_client_protocol_schema::v1::AGENT_METHOD_NAMES;

use crate::domain::CoreEvent;

use super::{AcpAdapterDescriptor, Caps};

/// Bundle of shared state threaded into the ACP client for Task 4's real
/// permission handler. Defined here so callers can name the type concisely.
pub struct PermissionContext {
    pub hub: Arc<crate::approval::ApprovalHub>,
    pub events: tokio::sync::broadcast::Sender<CoreEvent>,
}

/// Spawn an ACP adapter sidecar per its [`AcpAdapterDescriptor`], with stdio
/// piped and `kill_on_drop` set. Defined for the production path; unused by the
/// Task 1 test path, which injects a duplex transport instead.
///
/// The caller is responsible for taking the child's stdin/stdout and building a
/// `ByteStreams` transport from them (write half = stdin, read half = stdout),
/// then handing that to [`connect_and_initialize`].
pub async fn spawn_adapter(
    descriptor: &AcpAdapterDescriptor,
) -> std::io::Result<tokio::process::Child> {
    use std::process::Stdio;
    let mut cmd = tokio::process::Command::new(&descriptor.command);
    cmd.args(&descriptor.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    for key in &descriptor.env_remove {
        cmd.env_remove(key);
    }
    for (key, value) in &descriptor.env {
        cmd.env(key, value);
    }

    cmd.spawn()
}

/// Client capabilities advertised in 3A: **no** fs read/write, **no** terminal.
/// (Tasks 3-4 turn these on once the fs/terminal handlers exist.)
fn client_capabilities() -> ClientCapabilities {
    ClientCapabilities::new()
}

/// Read the capabilities Task 1 cares about out of an `initialize` response.
fn extract_caps(response: &InitializeResponse) -> Caps {
    Caps {
        // Top-level bool on AgentCapabilities (wire `loadSession`), NOT a field
        // on SessionCapabilities.
        supports_load: response.agent_capabilities.load_session,
        // Presence of an optional `close` capability on SessionCapabilities.
        supports_close: response
            .agent_capabilities
            .session_capabilities
            .close
            .is_some(),
    }
}

/// Connect a `Client` over `transport`, run `initialize`, and return the agent
/// capabilities we gate on. Proves the full builder + transport + `initialize`
/// round-trip against the real crate API.
///
/// If `sink` is `Some`, incoming `SessionNotification`s are forwarded to
/// [`crate::harness::acp::notification::handle`] for persistence + fan-out.
/// Pass `None` to keep the stub behaviour (Task 1/2 tests).
///
/// If `perm` is `Some`, incoming `RequestPermissionRequest`s are routed
/// through the [`crate::approval::ApprovalHub`] (Task 4). The hub resolves
/// the binary allow/deny and `map_response` converts it to the correct
/// answer-by-kind `RequestPermissionResponse`. Pass `None` to keep the
/// stub behaviour that responds with `Cancelled` (Task 1–3 tests).
pub async fn connect_and_initialize(
    transport: impl agent_client_protocol::ConnectTo<Client> + 'static,
    sink: Option<Arc<crate::harness::acp::notification::NotificationSink>>,
    perm: Option<PermissionContext>,
) -> Result<Caps, agent_client_protocol::Error> {
    let perm = perm.map(|p| (p.hub, p.events));

    Client
        .builder()
        .on_receive_notification(
            {
                async move |notification: SessionNotification, _cx| {
                    if let Some(ref s) = sink {
                        crate::harness::acp::notification::handle(notification, s).await;
                    }
                    Ok(())
                }
            },
            agent_client_protocol::on_receive_notification!(),
        )
        .on_receive_request(
            async move |request: RequestPermissionRequest, responder, _cx| {
                let Some((ref hub, ref events)) = perm else {
                    // Task 1–3 stub: no hub wired, decline all permission requests.
                    return responder.respond(RequestPermissionResponse::new(
                        RequestPermissionOutcome::Cancelled,
                    ));
                };

                let request_id = request.tool_call.tool_call_id.0.to_string();
                let session_pk = request.session_id.0.to_string();
                let tool = request
                    .tool_call
                    .fields
                    .title
                    .clone()
                    .unwrap_or_else(|| "unknown".to_string());
                let summary = tool.clone();

                let _ = events.send(CoreEvent::ApprovalRequested {
                    session_pk,
                    request_id: request_id.clone(),
                    tool,
                    summary,
                });

                let rx = hub.register(request_id.clone());
                let got_allow = rx.await.unwrap_or(false);
                let decision = if got_allow {
                    crate::domain::ApprovalDecision::AllowOnce
                } else {
                    crate::domain::ApprovalDecision::RejectOnce
                };
                let response =
                    crate::harness::acp::permission::map_response(&request, decision);
                responder.respond(response)
            },
            agent_client_protocol::on_receive_request!(),
        )
        .connect_with(transport, async move |cx: ConnectionTo<agent_client_protocol::Agent>| {
            let init_response: InitializeResponse = cx
                .send_request(
                    InitializeRequest::new(ProtocolVersion::LATEST)
                        .client_capabilities(client_capabilities()),
                )
                .block_task()
                .await
                .map_err(|err| {
                    let message = format!("ACP {} failed: {err}", AGENT_METHOD_NAMES.initialize);
                    agent_client_protocol::Error::internal_error().data(message)
                })?;

            Ok(extract_caps(&init_response))
        })
        .await
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn client_connects_and_initializes_against_mock_agent() {
        let (transport, _join) = crate::harness::acp::testkit::connect_mock(
            crate::harness::acp::testkit::MockAgent::new(),
        );
        let caps = super::connect_and_initialize(transport, None, None)
            .await
            .unwrap();
        assert!(caps.supports_load, "mock advertises loadSession=true");
        assert!(caps.supports_close, "mock advertises a close capability");
    }

    #[tokio::test]
    async fn permission_request_is_answered_from_the_hub() {
        let (_hub, got) = crate::harness::acp::testkit::run_prompt_with_permission(
            crate::domain::ApprovalDecision::AllowOnce,
        )
        .await;
        assert!(got.allowed, "agent received an allow selection");
    }
}
