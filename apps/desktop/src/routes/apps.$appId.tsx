import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";
import { AppDetailTabs } from "@/components/app-detail/AppDetailTabs";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function AppDetailPage() {
  const { appId } = Route.useParams();
  const navigate = useNavigate();
  const { data: appsData, isLoading: appsLoading } = (trpc as any).apps.getAvailableServers.useQuery();
  
  console.log("[AppDetailPage] Rendering with appId:", appId);
  console.log("[AppDetailPage] Apps data:", appsData);
  
  const app = appsData?.servers?.find((s: any) => s.id === appId);
  const isConnected = app?.connection?.status === "connected";
  
  console.log("[AppDetailPage] Found app:", app);
  console.log("[AppDetailPage] Is connected:", isConnected);

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

  if (!app) {
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
    <div className="flex flex-col w-full p-4 h-full">
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/apps" })}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          {app.iconUrl && (
            <img
              src={app.iconUrl}
              alt={app.name}
              className="h-8 w-8 rounded-lg object-contain shrink-0"
            />
          )}
          <div className="flex flex-col">
            <h1 className="text-2xl font-semibold">{app.name}</h1>
            {app.description && (
              <p className="text-sm text-muted-foreground">{app.description}</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <AppDetailTabs app={app} isConnected={isConnected} />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/apps/$appId")({
  component: AppDetailPage,
});

