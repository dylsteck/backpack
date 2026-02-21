import type { JSX } from "solid-js";
import { createSignal, onMount } from "solid-js";
import { isTauri } from "./utils/platform";

export interface ServerGateProps {
	/** Server URL to check (e.g. from Tauri or env). In Tauri, ensureServerReady is invoked first. */
	serverUrl: string;
	/** Callback when server is ready (receives resolved URL) */
	onReady?: (url: string) => void;
	children: JSX.Element;
}

export function ServerGate(props: ServerGateProps) {
	const [status, setStatus] = createSignal<"checking" | "ready" | "error">("checking");
	const [error, setError] = createSignal<string | null>(null);
	const [resolvedUrl, setResolvedUrl] = createSignal<string | null>(null);

	onMount(async () => {
		let url = props.serverUrl;

		// In Tauri: invoke ensureServerReady (health check + spawn sidecar if needed)
		const tauri = (window as unknown as { __TAURI__?: { core?: { invoke: (cmd: string) => Promise<string> } } }).__TAURI__;
		if (isTauri() && tauri?.core?.invoke) {
			try {
				const tauriUrl = await tauri.core.invoke("ensure_server_ready");
				url = tauriUrl;
				setResolvedUrl(tauriUrl);
			} catch (err) {
				setStatus("error");
				setError(err instanceof Error ? err.message : "Server not ready");
				return;
			}
		}

		if (!url) {
			setStatus("error");
			setError("No server URL configured");
			return;
		}

		try {
			const res = await fetch(`${url.replace(/\/$/, "")}/`, { method: "GET" });
			if (res.ok) {
				setStatus("ready");
				props.onReady?.(url);
			} else {
				setStatus("error");
				setError(`Server returned ${res.status}`);
			}
		} catch (err) {
			setStatus("error");
			setError(err instanceof Error ? err.message : "Failed to connect to server");
		}
	});

	return (
		<>
			{status() === "checking" && (
				<div class="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
					<div class="flex flex-col items-center gap-4">
						<div class="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
						<p class="text-sm text-zinc-400">Connecting to Cortex...</p>
					</div>
				</div>
			)}
			{status() === "error" && (
				<div class="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
					<div class="flex max-w-md flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
						<h2 class="text-lg font-semibold text-red-400">Connection Failed</h2>
						<p class="text-sm text-zinc-400">{error()}</p>
						<p class="text-xs text-zinc-500">
							Make sure the Cortex server is running (e.g. <code class="rounded bg-zinc-800 px-1">bun run dev:server</code>)
						</p>
					</div>
				</div>
			)}
			{status() === "ready" && props.children}
		</>
	);
}
