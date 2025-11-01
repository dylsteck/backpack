import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";
import { ViewToggle } from "@/components/ViewToggle";

function AppsPage() {
  const { data, isLoading, error } = (trpc as any).mcp.getAvailableServers.useQuery();

  return (
    <div className="flex flex-col h-full w-full -m-4">
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
        })}
        emptyMessage="No apps available"
      />
    </div>
  );
}

export const Route = createFileRoute("/apps")({
  component: AppsPage,
});

