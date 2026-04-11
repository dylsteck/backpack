import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Grid3x3, Search, Settings, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterProvider } from "@/contexts/FilterContext";
import { DetailSidebarProvider } from "@/contexts/DetailSidebarContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DetailSidebar } from "@/components/DetailSidebar";

interface NavItem {
	to: string;
	label: string;
	icon: typeof Home;
	exact?: boolean;
}

const navItems: NavItem[] = [
	{ to: "/", label: "Timeline", icon: Home, exact: true },
	{ to: "/apps", label: "Apps", icon: Grid3x3 },
	{ to: "/search", label: "Search", icon: Search },
	{ to: "/onboarding", label: "Setup", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
	return (
		<FilterProvider>
			<DetailSidebarProvider>
				<div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
					<aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar">
						<div className="flex h-12 items-center gap-2 border-b px-4 text-sm font-semibold drag">
							<Package className="h-4 w-4" />
							<span>Backpack</span>
						</div>
						<nav className="flex flex-1 flex-col gap-1 p-2 no-drag">
							{navItems.map(({ to, label, icon: Icon, exact }) => (
								<Link
									key={to}
									to={to}
									className={cn(
										"flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
									)}
									activeProps={{
										className: "bg-accent text-accent-foreground",
									}}
									activeOptions={{ exact: exact ?? false }}
								>
									<Icon className="h-4 w-4" />
									{label}
								</Link>
							))}
						</nav>
						<div className="border-t p-2 no-drag">
							<ThemeToggle />
						</div>
					</aside>
					<main className="flex flex-1 flex-col overflow-hidden">
						{children}
					</main>
					<DetailSidebar />
				</div>
			</DetailSidebarProvider>
		</FilterProvider>
	);
}
