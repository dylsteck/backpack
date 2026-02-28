import type { JSX } from "solid-js";
import { createSignal, onMount } from "solid-js";
import { isTauri } from "./utils/platform";

export interface ServerGateProps {
	serverUrl: string;
	onReady?: (url: string) => void;
	children: JSX.Element;
}

export function ServerGate(props: ServerGateProps) {
	const [status, setStatus] = createSignal<"checking" | "ready" | "error">("checking");
	const [error, setError] = createSignal<string | null>(null);

	onMount(async () => {
		let url = props.serverUrl;

		const tauri = (window as unknown as { __TAURI__?: { core?: { invoke: (cmd: string) => Promise<string> } } }).__TAURI__;
		if (isTauri() && tauri?.core?.invoke) {
			try {
				const tauriUrl = await tauri.core.invoke("ensure_server_ready");
				url = tauriUrl;
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
				<div class="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
					<div class="flex flex-col items-center gap-4">
						<p class="text-xl font-semibold text-[#e4e4ed] animate-pulse">Backpack</p>
						<p class="text-sm text-[#8b8ba0]">Connecting...</p>
					</div>
				</div>
			)}
			{status() === "error" && (
				<div class="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
					<div class="flex max-w-md flex-col gap-4 rounded-lg border border-red-500/20 bg-red-500/5 p-6">
						<div class="flex items-center gap-3">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
								<path d="M12 9v4"/>
								<path d="M12 17h.01"/>
							</svg>
							<h2 class="text-lg font-semibold text-[#e4e4ed]">Connection Failed</h2>
						</div>
						<p class="text-sm text-[#8b8ba0]">{error()}</p>
						<p class="text-xs text-[#5a5a70]">
							Make sure the Backpack server is running. Try{" "}
							<code class="rounded bg-[#1a1a25] px-1.5 py-0.5 text-[#818cf8]">bun run dev:server</code>
						</p>
						<button
							type="button"
							onClick={() => window.location.reload()}
							class="mt-2 rounded-md bg-[#4f46e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338ca] transition-colors"
						>
							Retry
						</button>
					</div>
				</div>
			)}
			{status() === "ready" && props.children}
		</>
	);
}
