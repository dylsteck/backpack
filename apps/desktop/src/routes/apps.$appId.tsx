import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";
import { AppDetailTabs } from "@/components/app-detail/AppDetailTabs";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppServer } from "@/hooks/useAppsFilter";

function AppDetailPage() {
  const { appId } = Route.useParams();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appsData, isLoading: appsLoading, error: appsError } = (trpc as any).apps.getAvailableServers.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes - apps list doesn't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  });

  const app = appsData?.servers?.find((s: AppServer) => 
    s.id.toLowerCase() === appId.toLowerCase() || 
    s.name.toLowerCase().replace(/\s+/g, '-') === appId.toLowerCase()
  );
  const isConnected = app?.connection?.status === "connected";

  if (appsError) {
    console.error("[AppDetailPage] Error loading app data:", appsError);
  }

  // Ensure app has required properties for AppDetailTabs
  const appWithDefaults = app ? {
    id: app.id,
    name: app.name || "",
    description: app.description || "",
    oauth: (app as AppServer & { oauth?: boolean }).oauth ?? false,
    iconUrl: app.iconUrl || "",
    config: (app as AppServer & { config?: Record<string, unknown> }).config || {},
    connectionType: app.connectionType,
    connection: app.connection,
  } as Parameters<typeof AppDetailTabs>[0]['app'] : null;

  if (appsLoading) {
    return (
      <div className="flex flex-col w-full p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/apps" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-4">
          <div className="h-10 w-full bg-muted animate-pulse rounded" />
          <div className="h-64 w-full bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!app || !appWithDefaults) {
    return (
      <div className="flex flex-col w-full p-4 items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">App not found</h2>
          <p className="text-muted-foreground">The app you're looking for doesn't exist.</p>
          <Button onClick={() => navigate({ to: "/apps" })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Apps
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-20 supports-backdrop-filter:bg-background/60">
        <div className="absolute inset-0 bg-linear-to-b from-muted/20 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 py-8 relative">
          <div className="flex items-start gap-6 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ to: "/apps" })}
              className="shrink-0 mt-1 hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-start gap-6">
              {appWithDefaults.iconUrl && (
                <div className="h-16 w-16 rounded-2xl bg-muted/50 p-3 flex items-center justify-center shrink-0 border border-border/50 shadow-sm">
                  <img
                    src={appWithDefaults.iconUrl}
                    alt={appWithDefaults.name}
                    className="h-full w-full rounded-xl object-contain"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2 pt-0.5">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{appWithDefaults.name}</h1>
                {appWithDefaults.description && (
                  <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">{appWithDefaults.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <AppDetailTabs app={appWithDefaults} isConnected={isConnected} />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/apps/$appId")({
  component: AppDetailPage,
});

