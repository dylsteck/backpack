import { createFileRoute, useNavigate, useRouter, Outlet, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ViewToggle } from "@/components/ViewToggle";
import { AppSetupDialog } from "@/components/AppSetupDialog";

function AppsPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const matches = useMatches();
  const { data, isLoading, error, refetch } = (trpc as any).apps.getAvailableServers.useQuery(undefined, {
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error("[AppsPage] Error fetching apps:", error);
    },
  });
  const [setupApp, setSetupApp] = useState<any>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  // Check if we're on a child route by checking the pathname
  const currentPath = router.state.location.pathname;
  const isOnChildRoute = currentPath.startsWith("/apps/") && currentPath !== "/apps";
  
  console.log("[AppsPage] Current pathname:", currentPath);
  console.log("[AppsPage] Current matches:", matches.map(m => m.routeId));
  console.log("[AppsPage] Is on child route:", isOnChildRoute);

  const handleSetupClick = (app: any) => {
    console.log("[AppsPage] handleSetupClick called:", { appId: app.id, app, connection: app.connection });
    
    // If app is connected, navigate to detail page
    if (app.connection && app.connection.status === "connected") {
      const targetPath = `/apps/${app.id}`;
      console.log("[AppsPage] Navigating to:", targetPath);
      console.log("[AppsPage] Current location before nav:", router.state.location.pathname);
      
      // Use navigate hook - simpler and more reliable
      navigate({ 
        to: "/apps/$appId",
        params: { appId: app.id }
      });
      return;
    }
    // Otherwise open setup dialog
    console.log("[AppsPage] Opening setup dialog for:", app.id);
    setSetupApp(app);
    setIsSetupOpen(true);
  };

  const handleCloseSetup = (open: boolean) => {
    setIsSetupOpen(open);
    if (!open) {
      setSetupApp(null);
      // Refetch apps to update connection status
      refetch();
    }
  };

  // If we're on a child route, only render the outlet
  if (isOnChildRoute) {
    console.log("[AppsPage] Rendering child route (outlet only)");
    return <Outlet />;
  }

  // Otherwise render the apps list
  console.log("[AppsPage] Rendering apps list");
  return (
    <div className="flex flex-col w-full p-4">
      <ViewToggle
        data={data?.servers || []}
        isLoading={isLoading}
        error={error}
        getIconUrl={(server) => server.iconUrl}
        getName={(server) => server.name}
        getFields={(server) => {
          // Return the full server object so handleSetupClick gets all data
          return server;
        }}
        emptyMessage="No apps available"
        onSetupClick={handleSetupClick}
      />
      <AppSetupDialog
        app={setupApp}
        open={isSetupOpen}
        onOpenChange={handleCloseSetup}
      />
    </div>
  );
}

export const Route = createFileRoute("/apps")({
  component: AppsPage,
  // Ensure child routes are properly handled
});

