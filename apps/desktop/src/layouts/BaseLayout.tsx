import React from "react";
import { useLocation, useParams } from "@tanstack/react-router";
import DragWindowRegion from "@/components/DragWindowRegion";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { getRouteTitle } from "@/utils/route-titles";
import { DetailSidebarProvider, useDetailSidebar } from "@/contexts/DetailSidebarContext";
import { BrowserHistoryDetailSidebar } from "@/components/timeline/BrowserHistoryDetailSidebar";
import { CastDetailSidebar } from "@/components/timeline/CastDetailSidebar";
import { TopbarFilterProvider, useTopbarFilter } from "@/contexts/TopbarFilterContext";
import { SourceFilterDropdown } from "@/components/filters/SourceFilterDropdown";
import { ConnectionFilterDropdown } from "@/components/filters/ConnectionFilterDropdown";
import { trpc } from "@/lib/trpc";
import type { AppServer } from "@/hooks/useAppsFilter";

function SidebarIcon() {
  const { state } = useSidebar();
  // Keep icon on the right side of sidebar area, ensuring it's visible (after traffic lights)
  // Traffic lights area is 76px, collapsed sidebar is 48px (3rem), expanded is 256px (16rem)
  const leftPosition = state === "collapsed"
    ? "calc(76px + 3rem - 1.5rem)" // Traffic lights + collapsed sidebar - less padding
    : "calc(16rem - 2.5rem)"; // Right side of expanded sidebar

  return (
    <div
      className="fixed top-0 h-[44px] z-50 flex items-center transition-[left] duration-200 ease-linear"
      style={{ left: leftPosition, WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <SidebarTrigger className="hover:bg-sidebar-accent" />
    </div>
  );
}

function TopbarTitle() {
  const { state } = useSidebar();
  const location = useLocation();
  const params = useParams({ strict: false });
  const { filterConfig } = useTopbarFilter();

  // Fetch app name for app detail pages
  const appId = params?.appId as string | undefined;
  const { data: appsData } = (trpc as unknown as {
    apps: {
      getAvailableServers: {
        useQuery: (input: undefined, options?: { staleTime?: number; gcTime?: number }) => {
          data?: { servers: AppServer[] };
        };
      };
    };
  }).apps.getAvailableServers.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const appName = React.useMemo(() => {
    if (appId && appsData?.servers) {
      const app = appsData.servers.find((s: AppServer) => s.id === appId);
      return app?.name;
    }
    return undefined;
  }, [appId, appsData]);

  const pageTitle = getRouteTitle(location.pathname, appName);

  // Calculate position to be right of sidebar icon
  // Sidebar icon is ~32px wide (h-8 w-8), positioned at leftPosition
  // We add the icon width + padding to position title to the right
  const leftPosition = state === "collapsed"
    ? "calc(76px + 3rem + 2rem)" // Traffic lights + collapsed sidebar + padding
    : "calc(16rem + 0.5rem)"; // Expanded sidebar + padding

  // Memoize filter component rendering to prevent unnecessary re-renders
  const filterComponent = React.useMemo(() => {
    if (!filterConfig) return null;
    
    if (filterConfig.type === "source") {
      return (
        <SourceFilterDropdown
          selectedSources={filterConfig.props.selectedSources}
          onSourceChange={filterConfig.props.onSourceChange}
          sourceCounts={filterConfig.props.sourceCounts}
        />
      );
    }
    
    if (filterConfig.type === "connection") {
      return (
        <ConnectionFilterDropdown
          selectedTypes={filterConfig.props.selectedTypes}
          selectedStatus={filterConfig.props.selectedStatus}
          onTypeChange={filterConfig.props.onTypeChange}
          onStatusChange={filterConfig.props.onStatusChange}
        />
      );
    }
    
    return null;
  }, [filterConfig]);

  return (
    <>
      {/* Full-width background bar to prevent bleed-through - only covers content area, not sidebar */}
      <div
        className="fixed top-0 h-[44px] z-40 bg-background/95 backdrop-blur-sm border-b"
        style={{ 
          left: state === "collapsed" ? "calc(76px + 3rem)" : "16rem",
          right: 0,
          pointerEvents: 'none'
        }}
      />
      {/* Title text positioned correctly */}
      <div
        className="fixed top-0 h-[44px] flex items-center z-40 transition-[left] duration-200 ease-linear text-base font-normal text-foreground select-none pointer-events-none"
        style={{ left: leftPosition }}
      >
        <span className="pointer-events-auto">{pageTitle}</span>
      </div>
      {/* Filter dropdown positioned on the right */}
      {filterComponent && (
        <div className="fixed top-0 right-0 h-[44px] flex items-center z-40 px-4 pointer-events-none">
          <div className="pointer-events-auto">{filterComponent}</div>
        </div>
      )}
    </>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { historySidebarOpen, setHistorySidebarOpen, selectedHistoryItem, castSidebarOpen, setCastSidebarOpen, selectedCast } = useDetailSidebar();
  const location = useLocation();
  const isOnboarding = location.pathname === "/onboarding";

  // If on onboarding route, render without sidebar/topbar
  if (isOnboarding) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className="relative flex h-screen w-full">
        <SidebarIcon />
        <TopbarTitle />
        <AppSidebar />
        <SidebarInset className="flex flex-col overflow-hidden min-h-0">
          <DragWindowRegion />
          <div className="h-[44px] shrink-0" />
          <main className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</main>
        </SidebarInset>
        {selectedHistoryItem && historySidebarOpen && (
          <SidebarProvider open={true} onOpenChange={setHistorySidebarOpen} defaultOpen={false}>
            <BrowserHistoryDetailSidebar
              open={historySidebarOpen}
              onOpenChange={setHistorySidebarOpen}
              data={selectedHistoryItem}
            />
          </SidebarProvider>
        )}
        {selectedCast && castSidebarOpen && (
          <SidebarProvider open={true} onOpenChange={setCastSidebarOpen} defaultOpen={false}>
            <CastDetailSidebar
              open={castSidebarOpen}
              onOpenChange={setCastSidebarOpen}
              cast={selectedCast}
            />
          </SidebarProvider>
        )}
      </div>
    </SidebarProvider>
  );
}

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TopbarFilterProvider>
      <DetailSidebarProvider>
        <LayoutContent>{children}</LayoutContent>
      </DetailSidebarProvider>
    </TopbarFilterProvider>
  );
}
