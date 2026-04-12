import type { QueryClient } from "@tanstack/react-query";

export const flyQueryKeys = {
	visits: (q?: string) => ["fly-visits", q ?? ""] as const,
	analytics: (range?: { from?: number; to?: number }) =>
		["fly-analytics", range?.from ?? "", range?.to ?? ""] as const,
};

export function invalidateFlyHistoryQueries(qc: QueryClient): void {
	void qc.invalidateQueries({ queryKey: ["fly-visits"] });
	void qc.invalidateQueries({ queryKey: ["fly-searches"] });
	void qc.invalidateQueries({ queryKey: ["fly-analytics"] });
}
