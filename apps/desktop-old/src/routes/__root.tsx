import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import Providers from "@/components/providers";
import SidebarLayout from "@/components/sidebar-layout";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<Providers>
			<div className="flex flex-col h-screen overflow-hidden bg-background">
				<div className="flex-1 overflow-hidden">
					<SidebarLayout>
						<main className="flex-1 overflow-y-auto h-full">
							<div className="container mx-auto px-8 py-8">
								<Outlet />
							</div>
						</main>
					</SidebarLayout>
				</div>
			</div>
			<TanStackRouterDevtools />
		</Providers>
	);
}

