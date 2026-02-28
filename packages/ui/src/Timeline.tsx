import type { JSX } from "solid-js";
import { createSignal } from "solid-js";
import { sourceColor } from "./tokens";

export interface TimelineItem {
	id: string;
	timestamp: Date | string;
	source: string;
	type: string;
	data: Record<string, unknown>;
}

export interface TimelineProps {
	items: TimelineItem[];
	sourceFilter?: string;
	loading?: boolean;
	formatDate?: (ts: Date | string) => string;
	availableSources?: string[];
	onSourceFilterChange?: (source: string | null) => void;
	children?: JSX.Element;
}

const defaultFormatDate = (ts: Date | string) => {
	const d = typeof ts === "string" ? new Date(ts) : ts;
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	const diffHours = Math.floor(diffMins / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays === 1) return "yesterday";
	if (diffDays < 7) return `${diffDays}d ago`;
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
	});
};

const SOURCE_LABELS: Record<string, string> = {
	obsidian: "Obsidian",
	farcaster: "Farcaster",
	teller: "Teller",
	chrome: "Chrome",
	brave: "Brave",
	safari: "Safari",
	manual: "Manual",
};

export function Timeline(props: TimelineProps) {
	const format = () => props.formatDate ?? defaultFormatDate;
	const [activeFilter, setActiveFilter] = createSignal<string | null>(props.sourceFilter ?? null);

	const filtered = () => {
		const f = activeFilter();
		return f ? props.items.filter((i) => i.source === f) : props.items;
	};

	const handleFilterClick = (source: string | null) => {
		setActiveFilter(source);
		props.onSourceFilterChange?.(source);
	};

	return (
		<div class="space-y-4">
			{/* Source filter bar */}
			{props.availableSources && props.availableSources.length > 0 && (
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => handleFilterClick(null)}
						class={`rounded-full px-3 py-1 text-sm transition-colors ${
							activeFilter() === null
								? "bg-[#4f46e5] text-white"
								: "bg-[#1a1a25] text-[#8b8ba0] hover:text-[#e4e4ed]"
						}`}
					>
						All
					</button>
					{props.availableSources.map((source) => (
						<button
							type="button"
							onClick={() => handleFilterClick(source)}
							class={`rounded-full px-3 py-1 text-sm transition-colors ${
								activeFilter() === source
									? "bg-[#4f46e5] text-white"
									: "bg-[#1a1a25] text-[#8b8ba0] hover:text-[#e4e4ed]"
							}`}
						>
							{SOURCE_LABELS[source] ?? source}
						</button>
					))}
				</div>
			)}

			{props.loading && (
				<div class="flex justify-center py-12">
					<div class="h-6 w-6 animate-spin rounded-full border-2 border-[#2a2a3a] border-t-[#4f46e5]" />
				</div>
			)}
			{!props.loading && filtered().length === 0 && (
				<div class="flex flex-col items-center gap-3 py-16 text-center">
					<p class="text-[#e4e4ed] font-medium">Your timeline is empty</p>
					<p class="text-sm text-[#5a5a70]">
						Connect a source and sync to see your data here.
					</p>
				</div>
			)}
			{!props.loading &&
				filtered().map((item) => (
					<div
						class="group flex gap-3 rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 transition-colors hover:bg-[#1a1a25]"
					>
						{/* Source color bar */}
						<div
							class={`w-0.5 shrink-0 rounded-full ${sourceColor[item.source] ?? "bg-[#8b8ba0]"}`}
						/>
						<div class="min-w-0 flex-1">
							<div class="flex items-center justify-between text-sm">
								<span class="text-[#5a5a70] capitalize">
									{SOURCE_LABELS[item.source] ?? item.source}
								</span>
								<span class="text-[#5a5a70]">{format()(item.timestamp)}</span>
							</div>
							<div class="mt-1.5 text-[#e4e4ed]">
								{props.children ? (props.children as any)(item) : <TimelineItemPreview item={item} />}
							</div>
						</div>
					</div>
				))}
		</div>
	);
}

function TimelineItemPreview(props: { item: TimelineItem }) {
	const d = props.item.data;
	const title = (d?.title as string) ?? "";
	const text = (d?.text as string) ?? (d?.content as string) ?? "";
	const preview = title || text;
	const displayText = preview ? String(preview).slice(0, 200) : JSON.stringify(d).slice(0, 150);

	return (
		<div>
			{title && <p class="font-medium text-sm">{title.length > 100 ? title.slice(0, 100) + "..." : title}</p>}
			{text && title !== text && (
				<p class="text-sm text-[#8b8ba0] mt-0.5 line-clamp-2">{text.slice(0, 200)}{text.length > 200 ? "..." : ""}</p>
			)}
			{!title && !text && (
				<p class="text-sm text-[#8b8ba0]">{displayText}</p>
			)}
		</div>
	);
}
