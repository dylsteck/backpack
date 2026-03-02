import type { BackpackPlugin, PluginContext, SyncOptions, SyncProgress } from "../types.js";
import { getSecret } from "../../auth/secrets.js";

export class TellerPlugin implements BackpackPlugin {
	name = "teller" as const;
	version = "1.0.0";
	description = "Sync bank transactions via Teller API";
	private context: PluginContext | null = null;

	async initialize(context: PluginContext): Promise<void> {
		this.context = context;
	}

	async isConfigured(): Promise<boolean> {
		const token = await getSecret("teller-access-token");
		return !!token;
	}

	async sync(_options?: SyncOptions): Promise<SyncProgress> {
		// Teller sync is handled by the server's SyncService
		// This plugin reports status but delegates to server
		return {
			source: this.name,
			itemsFound: 0,
			itemsAdded: 0,
			itemsUpdated: 0,
			errors: [],
		};
	}
}
