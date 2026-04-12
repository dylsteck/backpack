import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DetailSidebar } from "@/components/DetailSidebar";
import { DetailSidebarProvider } from "@/contexts/DetailSidebarContext";
import { FilterProvider } from "@/contexts/FilterContext";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({ children }: { children: ReactNode }) {
	return (
		<TooltipProvider delayDuration={0}>
			<SidebarProvider className="h-svh max-h-svh overflow-hidden">
				<FilterProvider>
					<DetailSidebarProvider>
						<AppSidebar />
						<SidebarInset className="min-h-0 flex flex-1 flex-row overflow-hidden">
							<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
								<header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 md:px-3">
									<SidebarTrigger className="no-drag" />
									<div
										className="h-full min-w-0 flex-1 pl-10 drag md:pl-12"
										aria-hidden
									/>
								</header>
								<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
									{children}
								</div>
							</div>
							<DetailSidebar />
						</SidebarInset>
					</DetailSidebarProvider>
				</FilterProvider>
			</SidebarProvider>
		</TooltipProvider>
	);
}
