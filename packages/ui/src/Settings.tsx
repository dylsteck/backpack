import type { JSX } from "solid-js";

export interface SettingsProps {
	serverUrl: string;
	onServerUrlChange?: (url: string) => void;
	version?: string;
	children?: JSX.Element;
}

export function Settings(props: SettingsProps) {
	return (
		<div class="space-y-6">
			{/* Server section */}
			<section>
				<h3 class="text-sm font-medium text-[#8b8ba0] uppercase tracking-wider mb-3">Server</h3>
				<div class="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 space-y-3">
					<div>
						<label class="block text-sm font-medium text-[#8b8ba0] mb-1.5">Server URL</label>
						<input
							type="url"
							value={props.serverUrl}
							onInput={(e) => props.onServerUrlChange?.(e.currentTarget.value)}
							class="w-full rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e4e4ed] placeholder-[#5a5a70] focus:border-[#4f46e5] focus:outline-none focus:ring-1 focus:ring-[#4f46e5] transition-colors"
							placeholder="http://localhost:3000"
							readOnly={!props.onServerUrlChange}
						/>
					</div>
					<div class="flex items-center gap-2">
						<span class="inline-block h-2 w-2 rounded-full bg-green-500" />
						<span class="text-sm text-[#8b8ba0]">Connected</span>
					</div>
				</div>
			</section>

			{/* About section */}
			<section>
				<h3 class="text-sm font-medium text-[#8b8ba0] uppercase tracking-wider mb-3">About</h3>
				<div class="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4">
					<p class="text-sm text-[#8b8ba0]">
						Backpack {props.version ? `v${props.version}` : ""}
					</p>
					<p class="mt-1 text-xs text-[#5a5a70]">
						Your personal data aggregator and timeline.
					</p>
				</div>
			</section>

			{props.children}
		</div>
	);
}
