import type { FlyVisitRow } from "@backpack/sdk";
import { ExternalLink } from "lucide-react";

function formatTime(ms: number): string {
	return new Date(ms).toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}

function dayLabel(ms: number): string {
	return new Date(ms).toLocaleDateString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function VisitedPanel({ visits }: { visits: FlyVisitRow[] }) {
	const groups = new Map<string, FlyVisitRow[]>();
	for (const v of visits) {
		const key = dayLabel(v.visitedAt);
		const list = groups.get(key) ?? [];
		list.push(v);
		groups.set(key, list);
	}
	const orderedDays = [...groups.keys()];

	if (visits.length === 0) {
		return (
			<p className="py-12 text-center text-sm text-muted-foreground">No visits yet.</p>
		);
	}

	return (
		<div className="space-y-8">
			{orderedDays.map((day) => (
				<section key={day}>
					<h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{day}
					</h3>
					<ul className="space-y-0 border-l border-border/60 pl-4">
						{(groups.get(day) ?? []).map((v) => (
							<li
								key={v.id}
								className="relative border-b border-border/40 py-3 pl-2 last:border-b-0"
							>
								{v.precedingVisitId ? (
									<span
										className="absolute -left-[5px] top-5 h-2 w-2 rounded-full bg-primary/50"
										aria-hidden
									/>
								) : null}
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-foreground">
											{v.title || v.domain || v.url}
										</p>
										<p className="mt-0.5 truncate text-xs text-muted-foreground">{v.url}</p>
										<p className="mt-1 text-[11px] text-muted-foreground">
											{v.domain} · {v.transition}
											{v.durationMs != null
												? ` · ${Math.round(v.durationMs / 1000)}s`
												: ""}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<span className="text-xs tabular-nums text-muted-foreground">
											{formatTime(v.visitedAt)}
										</span>
										<a
											href={v.url}
											target="_blank"
											rel="noreferrer"
											className="text-muted-foreground hover:text-foreground"
											title="Open"
										>
											<ExternalLink className="h-3.5 w-3.5" />
										</a>
									</div>
								</div>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
