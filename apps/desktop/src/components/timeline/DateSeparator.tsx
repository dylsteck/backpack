import { formatDateLabel } from "./format";

export function DateSeparator({ dateKey }: { dateKey: string }) {
	return (
		<div className="sticky top-0 z-10 -mx-6 flex items-center gap-3 bg-background/95 px-6 py-2 backdrop-blur">
			<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{formatDateLabel(dateKey)}
			</span>
			<div className="h-px flex-1 bg-border" />
		</div>
	);
}
