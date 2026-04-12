import type { Item } from "@backpack/sdk";
import { formatTime } from "./format";

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-[11px] font-medium text-muted-foreground/60">
				{label}
			</span>
			<span className="break-all text-[13px]">{value}</span>
		</div>
	);
}

export function renderEntryDetail(item: Item) {
	const data = item.data as Record<string, unknown>;

	return (
		<div className="flex flex-col gap-5">
			<Field label="Source" value={item.source} />
			<Field label="Type" value={item.type} />
			<Field
				label="Timestamp"
				value={`${new Date(item.timestamp).toLocaleDateString()} ${formatTime(item.timestamp)}`}
			/>
			{Object.entries(data)
				.filter(([, v]) => typeof v === "string" || typeof v === "number")
				.slice(0, 12)
				.map(([key, value]) => (
					<Field key={key} label={key} value={String(value)} />
				))}
		</div>
	);
}
