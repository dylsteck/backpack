import type { BackpackPlugin, PluginContext, SyncOptions, SyncProgress } from "../types.js";
import { getConfig } from "../../config/index.js";

export class ChromePlugin implements BackpackPlugin {
	name = "chrome" as const;
	version = "1.0.0";
	description = "Sync Chrome browser history";
	private context: PluginContext | null = null;

	async initialize(context: PluginContext): Promise<void> {
		this.context = context;
	}

	async isConfigured(): Promise<boolean> {
		const config = getConfig();
		const chromeConfig = (config as any).sources?.chrome;
		return !!chromeConfig?.enabled;
	}

	async sync(options?: SyncOptions): Promise<SyncProgress> {
		try {
			const { default: ChromeSyncer } = await import("../../sync/sources/chrome.js");
			const { getDatabase } = await import("../../db/index.js");
			const db = getDatabase();
			const syncer = new ChromeSyncer(db as any);
			const result = await syncer.sync(options as any);
			return {
				source: this.name,
				itemsFound: result.itemsFound,
				itemsAdded: result.itemsAdded,
				itemsUpdated: result.itemsUpdated ?? 0,
				errors: result.errors ?? [],
			};
		} catch (error: any) {
			return {
				source: this.name,
				itemsFound: 0,
				itemsAdded: 0,
				itemsUpdated: 0,
				errors: [error.message],
			};
		}
	}
}
