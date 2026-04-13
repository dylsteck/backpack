import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
	BookOpenIcon,
	GlobeIcon,
	Grid3x3Icon,
	HomeIcon,
	LifeBuoyIcon,
	PackageIcon,
	SearchIcon,
	SettingsIcon,
} from "lucide-react";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { runtime } from "@/lib/backpack-client";

const navMain = [
	{
		title: "Timeline",
		url: "/",
		icon: <HomeIcon />,
		exact: true as const,
	},
	{
		title: "Apps",
		url: "/apps",
		icon: <Grid3x3Icon />,
	},
	{
		title: "Search",
		url: "/search",
		icon: <SearchIcon />,
	},
	{
		title: "Fly",
		url: "/fly/browser",
		icon: <GlobeIcon />,
	},
];

const navSecondary = [
	{
		title: "Docs",
		url: "https://ui.shadcn.com/docs",
		icon: <BookOpenIcon />,
		external: true,
	},
	{
		title: "Repository",
		url: "https://github.com/dylsteck/backpack",
		icon: <LifeBuoyIcon />,
		external: true,
	},
];

export function AppSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar
			variant="inset"
			collapsible="offcanvas"
			className={cn(
				// hiddenInset: lights overlap content; inset below traffic lights (tighter than pt-14).
				runtime?.platform === "darwin" && "!px-2 !pb-2 !pt-11",
				className,
			)}
			{...props}
		>
			<SidebarHeader className={runtime?.platform === "darwin" ? "!pt-1.5" : undefined}>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to="/">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
									<PackageIcon className="size-4" />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">Backpack</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={navMain} />
				<NavSecondary items={navSecondary} className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild size="sm">
							<Link
								to="/onboarding"
								activeProps={{
									className:
										"bg-sidebar-accent text-sidebar-accent-foreground",
								}}
							>
								<SettingsIcon />
								<span>Setup</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
}
