import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "./router";
import { useMountEffect } from "./hooks/useMountEffect";
import { themeApi } from "./lib/backpack-client";

export function App() {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						retry: false,
						refetchOnWindowFocus: false,
						staleTime: 30_000,
					},
				},
			}),
	);
	const [router] = useState(() => createAppRouter(queryClient));

	useMountEffect(() => {
		themeApi.get().then(({ shouldUseDark }) => {
			document.documentElement.classList.toggle("dark", shouldUseDark);
		});
	});

	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}
