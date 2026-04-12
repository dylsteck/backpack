import type * as React from "react";
import { Link } from "@tanstack/react-router";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ChevronRightIcon } from "lucide-react";

export type NavMainItem = {
	title: string;
	url: string;
	icon: React.ReactNode;
	exact?: boolean;
	isActive?: boolean;
	items?: { title: string; url: string }[];
};

export function NavMain({ items }: { items: NavMainItem[] }) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Backpack</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) =>
					item.items?.length ? (
						<Collapsible
							key={item.title}
							asChild
							defaultOpen={item.isActive}
						>
							<SidebarMenuItem>
								<SidebarMenuButton asChild tooltip={item.title}>
									<Link to={item.url}>
										{item.icon}
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
								<CollapsibleTrigger asChild>
									<SidebarMenuAction className="data-[state=open]:rotate-90">
										<ChevronRightIcon />
										<span className="sr-only">Toggle</span>
									</SidebarMenuAction>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<SidebarMenuSub>
										{item.items.map((subItem) => (
											<SidebarMenuSubItem key={subItem.title}>
												<SidebarMenuSubButton asChild>
													<Link to={subItem.url}>
														<span>{subItem.title}</span>
													</Link>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										))}
									</SidebarMenuSub>
								</CollapsibleContent>
							</SidebarMenuItem>
						</Collapsible>
					) : (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild tooltip={item.title}>
								<Link
									to={item.url}
									activeOptions={{ exact: item.exact ?? false }}
									activeProps={{
										className: "bg-sidebar-accent text-sidebar-accent-foreground",
									}}
								>
									{item.icon}
									<span>{item.title}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					),
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
