import { Moon, Sun, Laptop } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { themeApi } from "@/lib/backpack-client";
import { applyTheme, type ThemeSource } from "@/lib/theme";
import { Button } from "@/components/ui/button";

const icons: Record<ThemeSource, typeof Sun> = {
	light: Sun,
	dark: Moon,
	system: Laptop,
};

const nextMode: Record<ThemeSource, ThemeSource> = {
	system: "light",
	light: "dark",
	dark: "system",
};

export function ThemeToggle() {
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
	const Icon = icons[current];

	return (
		<Button
			variant="ghost"
			size="sm"
			className="w-full justify-start gap-2 text-muted-foreground"
			onClick={() => setTheme.mutate(nextMode[current])}
		>
			<Icon className="h-4 w-4" />
			<span className="capitalize">{current}</span>
		</Button>
	);
}
