mod commands;
mod error;
mod events;

use ryuzi_core::{AcpAdapterDescriptor, ClaudeCodeIntegration, ControlPlane, Registries, Store};
use tauri::Manager;
use tauri_specta::{collect_commands, collect_events, Builder};

/// Resolve the ACP adapter command for the bundled Claude Code sidecar.
///
/// PLACEHOLDER (Spec 3B Task 5 wires the real bundled sidecar path): for now we
/// resolve `claude-code-acp` off the app dir / PATH. Starting a session without
/// a real adapter present will fail at runtime, but the app still compiles and
/// launches — which is all this task requires.
fn resolve_acp_adapter_command() -> String {
    const ADAPTER_BIN: &str = "claude-code-acp";
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join(ADAPTER_BIN);
            if p.exists() {
                return p.to_string_lossy().into_owned();
            }
        }
    }
    // Dev/fallback: rely on PATH resolution when the sidecar is not co-located.
    ADAPTER_BIN.to_string()
}

/// Build the extension registries and install the `claude-code` harness
/// integration over the (placeholder) ACP adapter descriptor.
fn build_registries() -> Registries {
    let descriptor = AcpAdapterDescriptor {
        command: resolve_acp_adapter_command(),
        args: vec![],
        env: vec![],
        env_remove: vec![],
    };
    let mut registries = Registries::new();
    registries.install(&ClaudeCodeIntegration::new(descriptor));
    registries
}

fn make_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            commands::list_projects,
            commands::list_sessions,
            commands::list_messages,
            commands::connect_project,
            commands::start_session,
            commands::continue_session,
            commands::stop_session,
            commands::end_session,
            commands::resolve_approval,
            commands::read_file,
            commands::pick_directory,
        ])
        .events(collect_events![events::CoreEventMsg])
}

pub fn run() {
    let builder = make_builder();

    #[cfg(debug_assertions)]
    {
        let out = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/bindings.ts");
        builder
            .export(
                specta_typescript::Typescript::default()
                    .bigint(specta_typescript::BigIntExportBehavior::Number),
                &out,
            )
            .expect("export bindings");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            // Build the engine inside the async runtime so Store::open (and any
            // harness setup) run within a Tokio context.
            let cp = tauri::async_runtime::block_on(async move {
                let store = Store::open(&ryuzi_core::paths::db_path())
                    .await
                    .expect("open ryuzi db");
                let registries = build_registries();
                ControlPlane::new(store, registries).await
            });
            // Subscribe BEFORE manage() moves the Arc.
            let mut rx = cp.subscribe();
            // Make Arc<ControlPlane> available to all Tauri commands.
            app.manage(cp);
            // Bridge: forward every CoreEvent from the broadcast channel to the webview.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri_specta::Event as _;
                use tokio::sync::broadcast::error::RecvError;
                loop {
                    match rx.recv().await {
                        Ok(ev) => {
                            let _ = events::CoreEventMsg { event: ev }.emit(&app_handle);
                        }
                        Err(RecvError::Lagged(n)) => {
                            eprintln!("[ryuzi] CoreEvent bridge lagged, skipped {n} event(s)");
                            continue;
                        }
                        Err(RecvError::Closed) => break,
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ryuzi");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Generates `src/bindings.ts` without launching the Tauri GUI.
    /// Run via: `cargo test -p ryuzi-cockpit export_bindings -- --nocapture`
    #[test]
    fn export_bindings() {
        let out = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/bindings.ts");
        make_builder()
            .export(
                specta_typescript::Typescript::default()
                    .bigint(specta_typescript::BigIntExportBehavior::Number),
                &out,
            )
            .expect("export bindings");
    }
}
