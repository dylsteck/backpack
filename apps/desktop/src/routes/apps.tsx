import { createFileRoute, useNavigate, Outlet, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ViewToggle } from "@/components/ViewToggle";
import { AppSetupDialog } from "@/components/AppSetupDialog";
import { useTopbarFilter } from "@/contexts/TopbarFilterContext";
import { useAppsFilter, type AppServer } from "@/hooks/useAppsFilter";

/**
 * AppsPage Component
 * 
 * Displays a grid of available apps/servers with filtering capabilities.
 * Uses `useAppsFilter` to handle connection type and status filtering.
 */
function AppsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, error, refetch } = (trpc as any).apps.getAvailableServers.useQuery(undefined, {
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes - apps list doesn't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    onError: (err: Error) => {
      console.error("[AppsPage] Error fetching apps:", err);
    },
  });
  const [setupApp, setSetupApp] = useState<AppServer | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const { setFilterConfig } = useTopbarFilter();

  // Use custom hook for filtering logic
  const {
    filteredServers,
    selectedTypes,
    selectedStatus,
    setSelectedTypes,
    setSelectedStatus
  } = useAppsFilter({ servers: data?.servers });

  // Check if we're on a child route by checking the pathname
  const isOnChildRoute = useMemo(() => {
    const path = location.pathname;
    // Match /apps/something but not /apps or /apps/
    return path.startsWith("/apps/") && path.length > 6;
  }, [location.pathname]);

  // Set filter component in topbar
  useEffect(() => {
    if (!isOnChildRoute) {
      setFilterConfig({
        type: "connection",
        props: {
          selectedTypes,
          selectedStatus,
          onTypeChange: setSelectedTypes,
          onStatusChange: setSelectedStatus,
        },
      });
    } else {
      setFilterConfig(null);
    }
    return () => {
      setFilterConfig(null);
    };
  }, [selectedTypes, selectedStatus, isOnChildRoute, setFilterConfig, setSelectedTypes, setSelectedStatus]);

  const handleSetupClick = useCallback((app: AppServer) => {
    // Always navigate to detail page when clicking an app
    if (app.id) {
      console.log("[AppsPage] Navigating to app detail:", app.id);
      navigate({
        to: "/apps/$appId",
        params: { appId: String(app.id) }
      });
    }
  }, [navigate]);

  const handleCloseSetup = useCallback((open: boolean) => {
    setIsSetupOpen(open);
    if (!open) {
      setSetupApp(null);
      // Refetch apps to update connection status
      refetch();
    }
  }, [refetch]);

  // If we're on a child route, only render the outlet
  if (isOnChildRoute) {
    return (
      <div className="flex flex-col w-full h-full min-h-0">
        <Outlet />
      </div>
    );
  }

  // Otherwise render the apps list
  return (
    <div className="flex flex-col w-full h-full overflow-y-auto scrollbar-hide">
      <div className="flex flex-col w-full p-6">
        <ViewToggle
          data={filteredServers}
          isLoading={isLoading}
          error={error instanceof Error ? error : null}
          getIconUrl={(server) => server.iconUrl || ""}
          getName={(server) => server.name || ""}
          getFields={(server) => server}
          emptyMessage="No apps match the selected filters"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSetupClick={handleSetupClick as any}
        />
        <AppSetupDialog
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          app={setupApp as any}
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

