import type { JSX } from "solid-js";
import { createSignal, For } from "solid-js";
import { sourceBorder } from "./tokens";

export interface OnboardingSource {
	id: string;
	name: string;
	description?: string;
	iconUrl?: string;
	connected: boolean;
	/** Source-specific fields to render an inline form */
	fields?: Array<{
		key: string;
		label: string;
		type: "text" | "folder" | "auto" | "oauth";
		placeholder?: string;
	}>;
}

export interface OnboardingProps {
	sources: OnboardingSource[];
	onConnectSource: (sourceId: string, data?: Record<string, string>) => void;
	onPickFolder?: (sourceId: string) => void;
	onContinue: () => void;
	hasAtLeastOneConnected: boolean;
}

export function Onboarding(props: OnboardingProps) {
	const [expandedId, setExpandedId] = createSignal<string | null>(null);
	const [formData, setFormData] = createSignal<Record<string, string>>({});

	const toggleExpand = (id: string) => {
		setExpandedId(expandedId() === id ? null : id);
		setFormData({});
	};

	const handleConnect = (sourceId: string) => {
		const source = props.sources.find((s) => s.id === sourceId);
		if (!source) return;

		const hasOAuthField = source.fields?.some((f) => f.type === "oauth");
		const hasFolderField = source.fields?.some((f) => f.type === "folder");
		const hasAutoField = source.fields?.some((f) => f.type === "auto");

		if (hasFolderField && props.onPickFolder) {
			props.onPickFolder(sourceId);
		} else if (hasOAuthField || hasAutoField) {
			props.onConnectSource(sourceId);
		} else {
			props.onConnectSource(sourceId, formData());
		}
	};

	return (
		<div class="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4">
			<div class="w-full max-w-2xl py-12">
				<div class="mb-8 text-center">
					<h1 class="text-2xl font-semibold text-[#e4e4ed]">Welcome to Backpack</h1>
					<p class="mt-2 text-[#8b8ba0]">Connect at least one source to get started</p>
				</div>

				<div class="space-y-3">
					<For each={props.sources}>
						{(source) => {
							const borderColor = () => sourceBorder[source.id] ?? "border-[#8b8ba0]";
							const isExpanded = () => expandedId() === source.id && !source.connected;

							return (
								<div class={`rounded-lg border border-[#1e1e2e] bg-[#12121a] overflow-hidden border-l-2 ${borderColor()}`}>
									<div class="flex items-center justify-between p-4">
										<div class="flex items-center gap-3">
											{source.iconUrl && (
												<img src={source.iconUrl} alt="" class="h-8 w-8 rounded" />
											)}
											<div>
												<h3 class="font-medium text-[#e4e4ed]">{source.name}</h3>
												{source.description && (
													<p class="text-sm text-[#5a5a70]">{source.description}</p>
												)}
											</div>
										</div>
										{source.connected ? (
											<div class="flex items-center gap-2">
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
													<path d="M20 6 9 17l-5-5"/>
												</svg>
												<span class="text-sm text-green-500">Connected</span>
											</div>
										) : (
											<button
												type="button"
												onClick={() => {
													if (source.fields && source.fields.length > 0 && !source.fields.every(f => f.type === "auto" || f.type === "oauth" || f.type === "folder")) {
														toggleExpand(source.id);
													} else {
														handleConnect(source.id);
													}
												}}
												class="rounded-md bg-[#4f46e5] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#4338ca] transition-colors"
											>
												Connect
											</button>
										)}
									</div>

									{isExpanded() && source.fields && (
										<div class="border-t border-[#1e1e2e] p-4 space-y-3">
											<For each={source.fields.filter(f => f.type === "text")}>
												{(field) => (
													<div>
														<label class="block text-sm font-medium text-[#8b8ba0] mb-1">{field.label}</label>
														<input
															type="text"
															placeholder={field.placeholder}
															value={formData()[field.key] ?? ""}
															onInput={(e) => {
																setFormData({ ...formData(), [field.key]: e.currentTarget.value });
															}}
															class="w-full rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e4e4ed] placeholder-[#5a5a70] focus:border-[#4f46e5] focus:outline-none focus:ring-1 focus:ring-[#4f46e5] transition-colors"
														/>
													</div>
												)}
											</For>
											<button
												type="button"
												onClick={() => handleConnect(source.id)}
												class="rounded-md bg-[#4f46e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338ca] transition-colors"
											>
												Save & Connect
											</button>
										</div>
									)}
								</div>
							);
						}}
					</For>
				</div>

				<div class="mt-8 flex justify-center">
					<button
						type="button"
						onClick={() => props.onContinue()}
						disabled={!props.hasAtLeastOneConnected}
						class={`rounded-md px-6 py-2.5 text-sm font-medium transition-colors ${
							props.hasAtLeastOneConnected
								? "bg-[#4f46e5] text-white hover:bg-[#4338ca]"
								: "bg-[#1a1a25] text-[#5a5a70] cursor-not-allowed"
						}`}
					>
						Continue to Backpack
					</button>
				</div>
			</div>
		</div>
	);
}
