import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { AppShell } from "./components/AppShell";
import { TimelineView } from "./components/timeline/TimelineView";
import { AppsGrid } from "./components/app-detail/AppsGrid";
import { AppDetail } from "./components/app-detail/AppDetail";
import { SearchView } from "./components/SearchView";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { FlyLayout } from "./components/fly/FlyLayout";
import { FlyIndexRedirect } from "./components/fly/FlyIndexRedirect";
import { FlyBrowserView } from "./components/fly/FlyBrowserView";
import { FlyHistoryView } from "./components/fly/history/FlyHistoryView";

interface RouterContext {
	queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: () => (
		<AppShell>
			<Outlet />
		</AppShell>
	),
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: TimelineView,
});

const appsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/apps",
	component: AppsGrid,
});

const appDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/apps/$appId",
	component: AppDetail,
});

const searchRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/search",
	component: SearchView,
});

const flyLayoutRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/fly",
	component: FlyLayout,
});

const flyIndexRoute = createRoute({
	getParentRoute: () => flyLayoutRoute,
	path: "/",
	component: FlyIndexRedirect,
});

const flyBrowserRoute = createRoute({
	getParentRoute: () => flyLayoutRoute,
	path: "browser",
	component: FlyBrowserView,
});

const flyHistoryRoute = createRoute({
	getParentRoute: () => flyLayoutRoute,
	path: "history",
	component: FlyHistoryView,
});

const onboardingRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/onboarding",
	component: OnboardingFlow,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	appsRoute,
	appDetailRoute,
	searchRoute,
	flyLayoutRoute.addChildren([flyIndexRoute, flyBrowserRoute, flyHistoryRoute]),
	onboardingRoute,
]);

export function createAppRouter(queryClient: QueryClient) {
	return createRouter({
		routeTree,
		defaultPreload: "intent",
		context: { queryClient },
	});
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
	interface Register {
		router: AppRouter;
	}
}
