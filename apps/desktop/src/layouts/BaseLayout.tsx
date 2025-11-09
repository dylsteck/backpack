import React from "react";
import { useLocation } from "@tanstack/react-router";
import DragWindowRegion from "@/components/DragWindowRegion";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { getRouteTitle } from "@/utils/route-titles";
import { DetailSidebarProvider, useDetailSidebar } from "@/contexts/DetailSidebarContext";
import { BrowserHistoryDetailSidebar } from "@/components/timeline/BrowserHistoryDetailSidebar";
import { CastDetailSidebar } from "@/components/timeline/CastDetailSidebar";
import { TopbarFilterProvider, useTopbarFilter } from "@/contexts/TopbarFilterContext";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";

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
      style={{ left: leftPosition }}
    >
      <SidebarTrigger className="hover:bg-sidebar-accent" />
    </div>
  );
}

function TopbarTitle() {
  const { state } = useSidebar();
  const location = useLocation();
  const pageTitle = getRouteTitle(location.pathname);
  const { filterComponent } = useTopbarFilter();
  
  // Calculate position to be right of sidebar icon
  // Sidebar icon is ~32px wide (h-8 w-8), positioned at leftPosition
  // We add the icon width + padding to position title to the right
  const leftPosition = state === "collapsed"
    ? "calc(76px + 3rem + 2rem)" // Traffic lights + collapsed sidebar + padding
    : "calc(16rem + 0.5rem)"; // Expanded sidebar + padding

  return (
    <>
      {/* Full-width background bar to prevent bleed-through */}
      <div 
        className="fixed top-0 left-0 right-0 h-[44px] z-40 bg-background/95 backdrop-blur-sm border-b"
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
	
	return (
		<SidebarProvider>
			<div className="relative flex h-screen w-full">
				<SidebarIcon />
				<TopbarTitle />
				<AppSidebar />
				<SidebarInset className="flex flex-col overflow-y-auto scrollbar-hide">
					<DragWindowRegion />
					<div className="h-[44px] flex-shrink-0" />
					<main className="flex-1">{children}</main>
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
