import { formatDateLabel } from "./format";

export function DateSeparator({ dateKey }: { dateKey: string }) {
	return (
		<div className="sticky top-0 z-10 -mx-6 bg-background/80 px-6 py-3 backdrop-blur-xl">
			<span className="text-[11px] font-medium text-muted-foreground/60">
				{formatDateLabel(dateKey)}
			</span>
		</div>
	);
}
