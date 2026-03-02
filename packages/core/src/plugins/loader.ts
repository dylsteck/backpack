import fs from "fs";
import path from "path";
import { getConfig } from "../config/index.js";
import type { PluginRegistry } from "./registry.js";
import type { BackpackPlugin } from "./types.js";

export async function loadBuiltinPlugins(registry: PluginRegistry): Promise<void> {
	// Lazy-load builtin plugins to avoid circular deps
	const { FarcasterPlugin } = await import("./builtin/farcaster.js");
	const { ObsidianPlugin } = await import("./builtin/obsidian.js");
	const { TellerPlugin } = await import("./builtin/teller.js");
	const { ChromePlugin } = await import("./builtin/chrome.js");

	await registry.register(new FarcasterPlugin());
	await registry.register(new ObsidianPlugin());
	await registry.register(new TellerPlugin());
	await registry.register(new ChromePlugin());
}

export async function loadExternalPlugins(registry: PluginRegistry): Promise<void> {
	const config = getConfig();
	const pluginDirs = (config as any).pluginDirs as string[] | undefined;
	if (!pluginDirs || pluginDirs.length === 0) return;

	for (const dir of pluginDirs) {
		if (!fs.existsSync(dir)) continue;

		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const pluginPath = path.join(dir, entry.name, "index.js");
			if (!fs.existsSync(pluginPath)) continue;

			try {
				const mod = await import(pluginPath);
				const plugin: BackpackPlugin = mod.default || mod;
				if (plugin.name && plugin.sync && plugin.isConfigured && plugin.initialize) {
					await registry.register(plugin);
				}
			} catch (error) {
				console.warn(`Failed to load plugin from ${pluginPath}:`, error);
			}
		}
	}
}
