import React, { useEffect, Suspense } from "react";
import { syncThemeWithLocal } from "./helpers/theme_helpers";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./utils/routes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "./lib/trpc";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000, // 30 seconds default stale time
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time
      refetchOnMount: false, // Don't refetch on mount if data is fresh
    },
  },
  // Enable query deduplication explicitly
  queryCache: undefined, // Use default cache which handles deduplication
});

function AppContent() {
  useEffect(() => {
    syncThemeWithLocal();
  }, []);

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
          <AppContent />
        </Suspense>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
