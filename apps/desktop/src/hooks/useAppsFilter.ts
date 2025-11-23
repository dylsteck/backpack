import { useMemo, useState } from "react";
import type { ConnectionType, ConnectionStatus } from "@/components/filters/ConnectionFilterDropdown";

export interface AppServer {
    id: string;
    name: string;
    description?: string;
    iconUrl?: string;
    connectionType?: string;
    connection?: {
        status: string;
    };
    [key: string]: any;
}

interface UseAppsFilterProps {
    servers?: AppServer[];
}

interface UseAppsFilterReturn {
    filteredServers: AppServer[];
    selectedTypes: ConnectionType[];
    selectedStatus: ConnectionStatus;
    setSelectedTypes: (types: ConnectionType[]) => void;
    setSelectedStatus: (status: ConnectionStatus) => void;
}

/**
 * Custom hook to filter app servers based on connection type and status.
 * Memoizes the filtered results to prevent unnecessary re-renders.
 * 
 * @param servers - The list of servers to filter
 * @returns Object containing filtered servers and filter control states
 */
export function useAppsFilter({ servers }: UseAppsFilterProps): UseAppsFilterReturn {
    const [selectedTypes, setSelectedTypes] = useState<ConnectionType[]>(["all"]);
    const [selectedStatus, setSelectedStatus] = useState<ConnectionStatus>("all");

    const filteredServers = useMemo(() => {
        if (!servers) return [];

        return servers.filter((server) => {
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
    }, [servers, selectedTypes, selectedStatus]);

    return {
        filteredServers,
        selectedTypes,
        selectedStatus,
        setSelectedTypes,
        setSelectedStatus,
    };
}
