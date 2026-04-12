import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { themeApi } from "@/lib/backpack-client";
import { applyTheme, type ThemeSource } from "@/lib/theme";
import { CheckIcon, ChevronsUpDownIcon, LaptopIcon, MoonIcon, SunIcon } from "lucide-react";

const defaultUser = {
	name: "Backpack",
	email: "Local · SQLite",
	avatar: "",
};

export function NavUser({
	user = defaultUser,
}: {
	user?: {
		name: string;
		email: string;
		avatar: string;
	};
}) {
	const { isMobile } = useSidebar();
	const qc = useQueryClient();
	const theme = useQuery({
		queryKey: ["theme"],
		queryFn: () => themeApi.get(),
	});
	const setTheme = useMutation({
		mutationFn: (source: ThemeSource) => applyTheme(source),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["theme"] }),
	});

	const current = (theme.data?.source ?? "system") as ThemeSource;

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								<AvatarImage src={user.avatar} alt={user.name} />
								<AvatarFallback className="rounded-lg">BP</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-xs">{user.email}</span>
							</div>
							<ChevronsUpDownIcon className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage src={user.avatar} alt={user.name} />
									<AvatarFallback className="rounded-lg">BP</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{user.name}</span>
									<span className="truncate text-xs">{user.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Appearance</DropdownMenuLabel>
						<DropdownMenuGroup>
							<DropdownMenuItem
								className="gap-2"
								onClick={() => setTheme.mutate("light")}
							>
								<SunIcon className="size-4" />
								Light
								{current === "light" ? (
									<CheckIcon className="ml-auto size-4 text-muted-foreground" />
								) : null}
							</DropdownMenuItem>
							<DropdownMenuItem
								className="gap-2"
								onClick={() => setTheme.mutate("dark")}
							>
								<MoonIcon className="size-4" />
								Dark
								{current === "dark" ? (
									<CheckIcon className="ml-auto size-4 text-muted-foreground" />
								) : null}
							</DropdownMenuItem>
							<DropdownMenuItem
								className="gap-2"
								onClick={() => setTheme.mutate("system")}
							>
								<LaptopIcon className="size-4" />
								System
								{current === "system" ? (
									<CheckIcon className="ml-auto size-4 text-muted-foreground" />
								) : null}
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<a
								href="https://github.com/dylsteck/backpack"
								target="_blank"
								rel="noopener noreferrer"
							>
								About this app
							</a>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
