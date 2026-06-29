use std::sync::Arc;
use harness_core::{ControlPlane, Store};
use tauri::Manager;

fn resolve_hook_path(app: &tauri::AppHandle) -> String {
    // In dev, the hook binary is built into target/<profile>/harness-hook.
    // In a bundled app it ships alongside the main binary (see Task: packaging, R3).
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join("harness-hook");
            if p.exists() {
                return p.to_string_lossy().into_owned();
            }
        }
    }
    // Dev fallback: fall through to PATH resolution in harness-core.
    let _ = app;
    "harness-hook".to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            // Build the engine synchronously on the async runtime.
            let cp = tauri::async_runtime::block_on(async {
                let store = Store::open(&harness_core::paths::db_path())
                    .await
                    .expect("open cockpit db");
                ControlPlane::new(store, Arc::new(harness_core::runtime::ProcessRunner)).await
            });
            // Enable the approval side-channel; errors are non-fatal (no hook binary in CI).
            cp.enable_approvals(resolve_hook_path(&handle)).ok();
            // Make Arc<ControlPlane> available to all Tauri commands (Tasks 4+).
            app.manage(cp);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running cockpit");
}
