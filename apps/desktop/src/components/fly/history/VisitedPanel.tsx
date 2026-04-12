import type { FlyVisitRow } from "@backpack/sdk";
import { formatHistoryDayKey, formatHistoryTime24 } from "./fly-history-dates";

function normalizeVisitUrl(url: string): string {
	try {
		const u = new URL(url);
		u.hash = "";
		let p = u.pathname.replace(/\/$/, "");
		if (!p) p = "/";
		return `${u.protocol}//${u.host}${p}`;
	} catch {
		return url;
	}
}

type AggregatedVisit = {
	latestAt: number;
	count: number;
	label: string;
	url: string;
};

function aggregateDay(visits: FlyVisitRow[]): AggregatedVisit[] {
	const byUrl = new Map<
		string,
		{ count: number; latestAt: number; label: string; url: string }
	>();
	for (const v of visits) {
		const key = normalizeVisitUrl(v.url);
		const label = v.title?.trim() || v.domain || v.url;
		const cur = byUrl.get(key);
		if (cur) {
			cur.count += 1;
			if (v.visitedAt > cur.latestAt) {
				cur.latestAt = v.visitedAt;
				cur.url = v.url;
				cur.label = v.title?.trim() || v.domain || v.url;
			}
		} else {
			byUrl.set(key, {
				count: 1,
				latestAt: v.visitedAt,
				label,
				url: v.url,
			});
		}
	}
	return [...byUrl.values()]
		.map((v) => ({
			latestAt: v.latestAt,
			count: v.count,
			label: v.label,
			url: v.url,
		}))
		.sort((a, b) => b.latestAt - a.latestAt);
}

function groupByDay(visits: FlyVisitRow[]): Map<string, FlyVisitRow[]> {
	const map = new Map<string, FlyVisitRow[]>();
	for (const v of visits) {
		const key = formatHistoryDayKey(v.visitedAt);
		const list = map.get(key) ?? [];
		list.push(v);
		map.set(key, list);
	}
	return map;
}

function orderedDayKeys(map: Map<string, FlyVisitRow[]>): string[] {
	return [...map.keys()].sort((a, b) => {
		const [da, ma, ya] = a.split(".").map(Number);
		const [db, mb, yb] = b.split(".").map(Number);
		return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
	});
}

export function VisitedPanel({ visits }: { visits: FlyVisitRow[] }) {
	const groups = groupByDay(visits);
	const orderedDays = orderedDayKeys(groups);

	if (visits.length === 0) {
		return (
			<p className="py-16 text-center font-mono text-sm text-muted-foreground">No visits yet.</p>
		);
	}

	return (
		<div className="space-y-10">
			{orderedDays.map((day) => {
				const rows = aggregateDay(groups.get(day) ?? []);
				return (
					<section key={day}>
						<div className="mb-4 border-b border-border/70 pb-2">
							<h2 className="font-mono text-base font-bold tracking-tight text-foreground">
								{day}
							</h2>
						</div>
						<div className="font-mono text-[13px] leading-relaxed">
							<div className="mb-2 grid grid-cols-[4.5rem_1fr_2rem] gap-4 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid-cols-[5rem_1fr_2.5rem]">
								<span>Time</span>
								<span>Page</span>
								<span className="text-right">#</span>
							</div>
							<ul className="divide-y divide-border/50">
								{rows.map((r) => (
									<li
										key={`${day}-${r.url}-${r.latestAt}`}
										className="grid grid-cols-[4.5rem_1fr_2rem] gap-4 py-2.5 text-foreground md:grid-cols-[5rem_1fr_2.5rem]"
									>
										<span className="tabular-nums text-muted-foreground">
											{formatHistoryTime24(r.latestAt)}
										</span>
										<a
											href={r.url}
											target="_blank"
											rel="noreferrer"
											className="min-w-0 break-words text-foreground hover:underline"
										>
											{r.label}
										</a>
										<span className="text-right tabular-nums text-muted-foreground">
											{r.count}
										</span>
									</li>
								))}
							</ul>
						</div>
					</section>
				);
			})}
		</div>
	);
}
