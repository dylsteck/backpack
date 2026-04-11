import { themeApi } from "./backpack-client";

export type ThemeSource = "system" | "light" | "dark";

export async function applyTheme(source: ThemeSource): Promise<ThemeSource> {
	const { shouldUseDark } = await themeApi.set(source);
	document.documentElement.classList.toggle("dark", shouldUseDark);
	return source;
}

export async function cycleTheme(current: ThemeSource): Promise<ThemeSource> {
	const next: ThemeSource =
		current === "system" ? "light" : current === "light" ? "dark" : "system";
	await applyTheme(next);
	return next;
}
