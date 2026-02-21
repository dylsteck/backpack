import type { JSX } from "solid-js";

export interface TimelineItem {
	id: string;
	timestamp: Date | string;
	source: string;
	type: string;
	data: Record<string, unknown>;
}

export interface TimelineProps {
	items: TimelineItem[];
	/** Optional: filter by source */
	sourceFilter?: string;
	/** Loading state */
	loading?: boolean;
	/** Format timestamp for display */
	formatDate?: (ts: Date | string) => string;
	children?: JSX.Element;
}

const defaultFormatDate = (ts: Date | string) => {
	const d = typeof ts === "string" ? new Date(ts) : ts;
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};

export function Timeline(props: TimelineProps) {
	const format = () => props.formatDate ?? defaultFormatDate;
	const filtered = () =>
		props.sourceFilter ? props.items.filter((i) => i.source === props.sourceFilter) : props.items;

	return (
		<div class="space-y-4">
			{props.loading && (
				<div class="flex justify-center py-8">
					<div class="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
				</div>
			)}
			{!props.loading && filtered().length === 0 && (
				<p class="py-8 text-center text-sm text-zinc-500">No items yet. Connect a source to get started.</p>
			)}
			{!props.loading &&
				filtered().map((item) => (
					<div
						key={item.id}
						class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
					>
						<div class="flex items-center justify-between text-sm text-zinc-500">
							<span class="font-medium capitalize text-zinc-400">{item.source}</span>
							<span>{format()(item.timestamp)}</span>
						</div>
						<div class="mt-2 text-zinc-100">
							{props.children ? props.children(item) : <TimelineItemPreview item={item} />}
						</div>
					</div>
				))}
		</div>
	);
}

function TimelineItemPreview(props: { item: TimelineItem }) {
	const d = props.item.data;
	// Cast/note preview
	const text = (d?.text as string) ?? (d?.content as string) ?? (d?.title as string) ?? "";
	const preview = text ? String(text).slice(0, 200) : JSON.stringify(d).slice(0, 150);
	return <p class="text-sm">{preview}{preview.length >= 200 ? "…" : ""}</p>;
}
