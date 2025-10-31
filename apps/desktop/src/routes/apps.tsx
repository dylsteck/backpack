import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";
import { ViewToggle } from "@/components/ViewToggle";

function AppsPage() {
  const { data, isLoading, error } = (trpc as any).mcp.getAvailableServers.useQuery();

  return (
    <div className="flex flex-col p-6">
      <ViewToggle
        data={data?.servers || []}
        isLoading={isLoading}
        error={error}
        title="My apps"
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
          domains: server.domains,
        })}
        emptyMessage="No apps available"
      />
    </div>
  );
}

export const Route = createFileRoute("/apps")({
  component: AppsPage,
});

