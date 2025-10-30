import React from "react";
import DragWindowRegion from "@/components/DragWindowRegion";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

function SidebarIcon() {
  const { state } = useSidebar();
  // Keep icon on the right side of sidebar area, ensuring it's visible (after traffic lights)
  // Traffic lights area is 76px, collapsed sidebar is 48px (3rem), expanded is 256px (16rem)
  const leftPosition = state === "collapsed" 
    ? "calc(76px + var(--sidebar-width-icon) - 1.5rem)" // Traffic lights + collapsed sidebar - less padding
    : "calc(var(--sidebar-width) - 2.5rem)"; // Right side of expanded sidebar

  return (
    <div 
      className="fixed top-[5.5px] z-50 flex items-center transition-[left] duration-200 ease-linear"
      style={{ left: leftPosition }}
    >
      <SidebarTrigger className="hover:bg-sidebar-accent" />
    </div>
  );
}

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full">
        <SidebarIcon />
        <AppSidebar />
        <SidebarInset>
          <DragWindowRegion title="electron-shadcn" />
          <div className="h-[44px]" /> {/* Spacer for top bar */}
          <main className="flex-1 overflow-auto p-4">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
