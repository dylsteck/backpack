//! Cortex desktop app - Tauri backend.
//! See [Cursor Plan](/Users/dylansteck/.cursor/plans/web_desktop_solidjs_tauri_82a62d90.plan.md)
//! and [.planning/WEB-DESKTOP-APPS.md](.planning/WEB-DESKTOP-APPS.md).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_shell::ShellExt;

pub fn run() {
	tauri::Builder::default()
		.plugin(tauri_plugin_shell::init())
		.plugin(tauri_plugin_dialog::init())
		.invoke_handler(tauri::generate_handler![get_server_url, ensure_server_ready])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}

const DEFAULT_PORT: u16 = 3000;

/// Returns the server URL for the frontend to use.
/// In bundled mode, this comes from the sidecar; otherwise localhost:3000.
#[tauri::command]
fn get_server_url() -> String {
	format!("http://localhost:{}", DEFAULT_PORT)
}

/// Ensures the server is ready (health check or spawn sidecar).
/// Used by ServerGate before rendering main UI.
#[tauri::command]
async fn ensure_server_ready(app: tauri::AppHandle) -> Result<String, String> {
	let url = format!("http://localhost:{}", DEFAULT_PORT);
	let health_url = format!("{}/mcp/health", url);

	// 1. Health check
	if let Ok(res) = reqwest::get(&health_url).await {
		if res.status().is_success() {
			return Ok(url);
		}
	}

	// 2. Try to spawn sidecar (bundled mode only)
	let sidecar = app
		.shell()
		.sidecar("server")
		.map_err(|_| "Server not reachable. Start with: bun run dev:server".to_string())?;
	let port = DEFAULT_PORT.to_string();
	let (_rx, _child) = sidecar
		.env("PORT", &port)
		.spawn()
		.map_err(|e| format!("Failed to spawn server sidecar: {}", e))?;

	// Wait for server to be ready (poll health endpoint)
	for _ in 0..30 {
		tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
		if let Ok(res) = reqwest::get(&health_url).await {
			if res.status().is_success() {
				return Ok(url);
			}
		}
	}
	Err("Sidecar started but server did not become ready in time".to_string())
}
