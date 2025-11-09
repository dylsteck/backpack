import { createFileRoute, useNavigate, useRouter, Outlet, useMatches } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ViewToggle } from "@/components/ViewToggle";
import { AppSetupDialog } from "@/components/AppSetupDialog";
import { ConnectionFilterDropdown, type ConnectionType, type ConnectionStatus } from "@/components/filters/ConnectionFilterDropdown";
import { useTopbarFilter } from "@/contexts/TopbarFilterContext";

function AppsPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const matches = useMatches();
  const { data, isLoading, error, refetch } = (trpc as any).apps.getAvailableServers.useQuery(undefined, {
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error: Error) => {
      console.error("[AppsPage] Error fetching apps:", error);
    },
  });
  const [setupApp, setSetupApp] = useState<any>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<ConnectionType[]>(["all"]);
  const [selectedStatus, setSelectedStatus] = useState<ConnectionStatus>("all");
  const { setFilterComponent } = useTopbarFilter();

  // Check if we're on a child route by checking the pathname
  const currentPath = router.state.location.pathname;
  const isOnChildRoute = currentPath.startsWith("/apps/") && currentPath !== "/apps";

  // Filter servers based on selected connection type and status
  const filteredServers = useMemo(() => {
    if (!data?.servers) return [];
    
    return data.servers.filter((server: any) => {
      // Filter by connection type
      const connectionType = (server.connectionType || "mcp").toLowerCase() as ConnectionType;
      const typeMatch = selectedTypes.includes("all") || selectedTypes.includes(connectionType);
      
      // Filter by connection status
      const connectionStatus = server.connection?.status || "disconnected";
      const statusMatch = 
        selectedStatus === "all" || 
        (selectedStatus === "connected" && connectionStatus === "connected") ||
        (selectedStatus === "disconnected" && connectionStatus !== "connected");
      
      return typeMatch && statusMatch;
    });
  }, [data?.servers, selectedTypes, selectedStatus]);

  // Set filter component in topbar
  useEffect(() => {
    if (!isOnChildRoute) {
      setFilterComponent(
        <ConnectionFilterDropdown
          selectedTypes={selectedTypes}
          selectedStatus={selectedStatus}
          onTypeChange={setSelectedTypes}
          onStatusChange={setSelectedStatus}
        />
      );
    } else {
      setFilterComponent(null);
    }
    return () => {
      setFilterComponent(null);
    };
  }, [selectedTypes, selectedStatus, isOnChildRoute, setFilterComponent]);

  const handleSetupClick = (app: any) => {
    // If app is connected, navigate to detail page
    if (app.connection && app.connection.status === "connected") {
      navigate({ 
        to: "/apps/$appId",
        params: { appId: app.id }
      });
      return;
    }
    // Otherwise open setup dialog
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
    return <Outlet />;
  }

  // Otherwise render the apps list
  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col w-full p-4">
        <ViewToggle
          data={filteredServers}
          isLoading={isLoading}
          error={error}
          getIconUrl={(server) => server.iconUrl}
          getName={(server) => server.name}
          getFields={(server) => {
            // Return the full server object so handleSetupClick gets all data
            return server;
          }}
          emptyMessage="No apps match the selected filters"
          onSetupClick={handleSetupClick}
        />
        <AppSetupDialog
          app={setupApp}
          open={isSetupOpen}
          onOpenChange={handleCloseSetup}
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/apps")({
  component: AppsPage,
  // Ensure child routes are properly handled
});

