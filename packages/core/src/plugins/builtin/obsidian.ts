import type { BackpackPlugin, PluginContext, SyncOptions, SyncProgress } from "../types.js";
import { getConfig } from "../../config/index.js";

export class ObsidianPlugin implements BackpackPlugin {
	name = "obsidian" as const;
	version = "1.0.0";
	description = "Sync Obsidian vault notes";
	private context: PluginContext | null = null;

	async initialize(context: PluginContext): Promise<void> {
		this.context = context;
	}

	async isConfigured(): Promise<boolean> {
		const config = getConfig();
		const obsidianConfig = (config as any).sources?.obsidian;
		return !!obsidianConfig?.vaultPath;
	}

	async sync(options?: SyncOptions): Promise<SyncProgress> {
		const { ObsidianSyncer } = await import("../../sync/sources/obsidian.js");
		const { getDatabase } = await import("../../db/index.js");
		const db = getDatabase();
		const syncer = new ObsidianSyncer(db as any);
		const result = await syncer.sync(options as any);
		return {
			source: this.name,
			itemsFound: result.itemsFound,
			itemsAdded: result.itemsAdded,
			itemsUpdated: result.itemsUpdated ?? 0,
			errors: result.errors ?? [],
		};
	}
}
