import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import Providers from "@/components/providers";
import Navbar from "@/components/navbar";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<Providers>
			<div className="min-h-screen">
				<Navbar />
				<main className="container mx-auto px-8 py-8">
					<Outlet />
				</main>
			</div>
			<TanStackRouterDevtools />
		</Providers>
	);
}

