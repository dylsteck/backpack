import type { BackpackPlugin, PluginContext, SyncOptions, SyncProgress } from "../types.js";
import { getConfig } from "../../config/index.js";

export class FarcasterPlugin implements BackpackPlugin {
	name = "farcaster" as const;
	version = "1.0.0";
	description = "Sync Farcaster casts via Neynar API";
	private context: PluginContext | null = null;

	async initialize(context: PluginContext): Promise<void> {
		this.context = context;
	}

	async isConfigured(): Promise<boolean> {
		const config = getConfig();
		const farcasterConfig = (config as any).sources?.farcaster;
		return !!farcasterConfig?.apiKey && !!farcasterConfig?.fid;
	}

	async sync(options?: SyncOptions): Promise<SyncProgress> {
		const { FarcasterSyncer } = await import("../../sync/sources/farcaster.js");
		const { getDatabase } = await import("../../db/index.js");
		const db = getDatabase();
		const syncer = new FarcasterSyncer(db as any);
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
