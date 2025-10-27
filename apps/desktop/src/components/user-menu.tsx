import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	Button,
	Skeleton,
} from "@cortex/shared/components";
import { authClient } from "@/lib/auth-client";
import { useRouter, Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

export default function UserMenu() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const { theme, setTheme } = useTheme();

	const getThemeLabel = () => {
		if (theme === "light") return "Light";
		if (theme === "dark") return "Dark";
		return "System";
	};

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!session) {
		return (
			<Button variant="outline" asChild>
				<Link to="/login">Sign In</Link>
			</Button>
		);
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<DropdownMenu>
					<TooltipTrigger asChild>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">{session.user.name}</Button>
						</DropdownMenuTrigger>
					</TooltipTrigger>
					<DropdownMenuContent className="bg-card" align="end">
						<DropdownMenuLabel>My Account</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem disabled>{session.user.email}</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Theme</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => setTheme("light")}>
							<Sun className="mr-2 h-4 w-4" />
							Light
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setTheme("dark")}>
							<Moon className="mr-2 h-4 w-4" />
							Dark
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setTheme("system")}>
							<Monitor className="mr-2 h-4 w-4" />
							System
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Button
								variant="destructive"
								className="w-full"
								onClick={() => {
									authClient.signOut({
										fetchOptions: {
											onSuccess: () => {
												router.navigate({ to: "/" });
											},
										},
									});
								}}
							>
								Sign Out
							</Button>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<TooltipContent>
					<p>{getThemeLabel()}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
