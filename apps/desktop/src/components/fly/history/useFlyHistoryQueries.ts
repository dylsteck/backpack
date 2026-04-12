import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flyApi } from "@/lib/backpack-client";
import { flyQueryKeys, invalidateFlyHistoryQueries } from "@/lib/fly-history-queries";

const RANGE_MS = 30 * 24 * 60 * 60 * 1000;

export function useFlyHistoryQueries(filter: string) {
	const queryClient = useQueryClient();

	const visitsQuery = useQuery({
		queryKey: flyQueryKeys.visits(filter),
		queryFn: () => {
			const rangeTo = Date.now();
			return flyApi.listVisits({
				q: filter || undefined,
				limit: 400,
				from: rangeTo - RANGE_MS,
				to: rangeTo,
			});
		},
		staleTime: 15_000,
	});

	const analyticsQuery = useQuery({
		queryKey: ["fly-analytics", "rolling-30d"] as const,
		queryFn: () => {
			const rangeTo = Date.now();
			return flyApi.analytics({ from: rangeTo - RANGE_MS, to: rangeTo });
		},
		staleTime: 30_000,
	});

	const deleteMut = useMutation({
		mutationFn: () => flyApi.deleteAllHistory(),
		onSuccess: () => invalidateFlyHistoryQueries(queryClient),
	});

	return { visitsQuery, analyticsQuery, deleteMut };
}
