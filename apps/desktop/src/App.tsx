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
    },
  },
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
