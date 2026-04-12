import { formatDateLabel } from "./format";

export function DateSeparator({ dateKey }: { dateKey: string }) {
	return (
		<div className="sticky top-0 z-10 -mx-8 bg-background/80 px-8 py-3.5 backdrop-blur-2xl">
			<span className="text-[11px] font-medium text-muted-foreground/60">
				{formatDateLabel(dateKey)}
			</span>
		</div>
	);
}
