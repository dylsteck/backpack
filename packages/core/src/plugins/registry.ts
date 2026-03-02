import type { BackpackPlugin, PluginContext } from "./types.js";

export class PluginRegistry {
	private plugins: Map<string, BackpackPlugin> = new Map();
	private context: PluginContext | null = null;

	setContext(context: PluginContext): void {
		this.context = context;
	}

	async register(plugin: BackpackPlugin): Promise<void> {
		if (this.plugins.has(plugin.name)) {
			throw new Error(`Plugin "${plugin.name}" is already registered`);
		}
		if (this.context) {
			await plugin.initialize(this.context);
		}
		this.plugins.set(plugin.name, plugin);
	}

	unregister(name: string): void {
		this.plugins.delete(name);
	}

	get(name: string): BackpackPlugin | undefined {
		return this.plugins.get(name);
	}

	getAll(): BackpackPlugin[] {
		return Array.from(this.plugins.values());
	}

	getNames(): string[] {
		return Array.from(this.plugins.keys());
	}

	async getConfigured(): Promise<BackpackPlugin[]> {
		const results: BackpackPlugin[] = [];
		for (const plugin of this.plugins.values()) {
			if (await plugin.isConfigured()) {
				results.push(plugin);
			}
		}
		return results;
	}

	async syncAll(options?: { force?: boolean }): Promise<Map<string, { success: boolean; error?: string }>> {
		const results = new Map<string, { success: boolean; error?: string }>();
		const configured = await this.getConfigured();

		for (const plugin of configured) {
			try {
				await plugin.sync(options);
				results.set(plugin.name, { success: true });
			} catch (error: any) {
				results.set(plugin.name, { success: false, error: error.message });
			}
		}

		return results;
	}
}

export const registry = new PluginRegistry();
