import type { JSX } from "solid-js";

export interface SettingsProps {
	serverUrl: string;
	onServerUrlChange?: (url: string) => void;
	children?: JSX.Element;
}

export function Settings(props: SettingsProps) {
	return (
		<div class="space-y-6">
			<h2 class="text-lg font-semibold text-zinc-100">Settings</h2>
			<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
				<label class="block text-sm font-medium text-zinc-400">Server URL</label>
				<input
					type="url"
					value={props.serverUrl}
					onInput={(e) => props.onServerUrlChange?.(e.currentTarget.value)}
					class="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
					placeholder="http://localhost:3000"
					readOnly={!props.onServerUrlChange}
				/>
				<p class="mt-1 text-xs text-zinc-500">
					The Cortex API server. Must be running for the app to work.
				</p>
			</div>
			{props.children}
		</div>
	);
}
