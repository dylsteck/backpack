import type { FlySearchRow } from "@backpack/sdk";
import { Search } from "lucide-react";

function formatWhen(ms: number): string {
	return new Date(ms).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function SearchesPanel({ rows }: { rows: FlySearchRow[] }) {
	if (rows.length === 0) {
		return (
			<p className="py-12 text-center text-sm text-muted-foreground">No searches recorded.</p>
		);
	}

	return (
		<ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card/30">
			{rows.map((r) => (
				<li key={r.id} className="flex items-start gap-3 px-4 py-3">
					<Search className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium text-foreground">{r.query}</p>
						<p className="mt-0.5 text-xs text-muted-foreground">
							{r.engine ?? "search"} · {formatWhen(r.searchedAt)}
						</p>
					</div>
				</li>
			))}
		</ul>
	);
}
