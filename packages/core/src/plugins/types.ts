import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

export interface SyncOptions {
	force?: boolean;
	since?: Date;
}

export interface SyncProgress {
	source: string;
	itemsFound: number;
	itemsAdded: number;
	itemsUpdated: number;
	errors: string[];
}

export interface PluginContext {
	db: BunSQLiteDatabase<any>;
	configDir: string;
	getSecret: (key: string) => Promise<string | null>;
	setSecret: (key: string, value: string) => Promise<void>;
}

export interface BackpackPlugin {
	name: string;
	version: string;
	description?: string;

	sync(options?: SyncOptions): Promise<SyncProgress>;
	isConfigured(): Promise<boolean>;
	initialize(context: PluginContext): Promise<void>;
}
