import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ViewToggle } from "@/components/ViewToggle";
import { AppSetupDialog } from "@/components/AppSetupDialog";

function AppsPage() {
  const { data, isLoading, error, refetch } = (trpc as any).apps.getAvailableServers.useQuery();
  const [setupApp, setSetupApp] = useState<any>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const handleSetupClick = (app: any) => {
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

  return (
    <div className="flex flex-col w-full p-4">
      <ViewToggle
        data={data?.servers || []}
        isLoading={isLoading}
        error={error}
        getIconUrl={(server) => server.iconUrl}
        getName={(server) => server.name}
        getFields={(server) => ({
          id: server.id,
          name: server.name,
          description: server.description,
          transport: server.transport,
          oauth: server.oauth,
          iconUrl: server.iconUrl,
          config: server.config,
          connectionType: server.connectionType,
          connection: server.connection,
        })}
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
});

