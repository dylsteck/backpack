import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

export type NavSecondaryItem = {
	title: string;
	url: string;
	icon: React.ReactNode;
	external?: boolean;
};

export function NavSecondary({
	items,
	...props
}: {
	items: NavSecondaryItem[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild size="sm">
								{item.external ? (
									<a
										href={item.url}
										target="_blank"
										rel="noopener noreferrer"
									>
										{item.icon}
										<span>{item.title}</span>
									</a>
								) : (
									<Link
										to={item.url}
										activeProps={{
											className:
												"bg-sidebar-accent text-sidebar-accent-foreground",
										}}
									>
										{item.icon}
										<span>{item.title}</span>
									</Link>
								)}
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
