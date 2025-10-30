import { Link, useRouterState } from "@tanstack/react-router";
import {
	SidebarProvider,
	Sidebar,
	SidebarHeader,
	SidebarContent,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarFooter,
	SidebarInset,
} from "@cortex/ui/components";
import CortexIcon from "./cortex-icon";
import UserMenu from "./user-menu";
import { Home, Package, Network, MessageSquare } from "lucide-react";

interface SidebarLayoutProps {
	children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
	const router = useRouterState();
	const pathname = router.location.pathname;

	const navItems = [
		{ to: "/", label: "Home", icon: Home },
		{ to: "/items", label: "Items", icon: Package },
		{ to: "/connections", label: "Connections", icon: Network },
		{ to: "/chat", label: "Chat", icon: MessageSquare },
	] as const;

	// On macOS, account for traffic lights (approximately 78px)
	const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
	const leftPadding = isMac ? '80px' : '16px';

	return (
		<SidebarProvider defaultOpen={true} className="h-full">
			<Sidebar 
				collapsible="none" 
				variant="inset"
			>
				<SidebarHeader 
					className="border-b border-sidebar-border"
					style={{
						WebkitAppRegion: "drag",
						appRegion: "drag",
						paddingLeft: leftPadding,
					}}
				>
					<div 
						className="flex items-center gap-2 px-2"
						style={{ WebkitAppRegion: "no-drag", appRegion: "no-drag" }}
					>
						<CortexIcon size={20} />
						<span className="text-sm font-semibold text-sidebar-foreground">Cortex</span>
					</div>
				</SidebarHeader>
				<SidebarContent>
					<SidebarMenu>
						{navItems.map(({ to, label, icon: Icon }) => {
							const isActive = pathname === to;
							return (
								<SidebarMenuItem key={to}>
									<SidebarMenuButton
										asChild
										isActive={isActive}
										tooltip={label}
									>
										<Link to={to}>
											<Icon className="size-4" />
											<span>{label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</SidebarContent>
				<SidebarFooter className="border-t border-sidebar-border">
					<UserMenu />
				</SidebarFooter>
			</Sidebar>
			<SidebarInset className="flex flex-col overflow-hidden bg-background">
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}

