import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ViewToggle } from "@/components/ViewToggle";
import { AppDetailsSidebar } from "@/components/AppDetailsSidebar";

function AppsPage() {
  const { data, isLoading, error } = (trpc as any).mcp.getAvailableServers.useQuery();
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAppClick = (app: any) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  const handleCloseModal = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedApp(null);
    }
  };

  return (
    <div className="flex flex-col w-full -m-4">
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
        })}
        emptyMessage="No apps available"
        onAppClick={handleAppClick}
      />
      <AppDetailsSidebar
        app={selectedApp}
        open={isModalOpen}
        onOpenChange={handleCloseModal}
      />
    </div>
  );
}

export const Route = createFileRoute("/apps")({
  component: AppsPage,
});

