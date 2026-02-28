import { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { apps, type AppConfig } from "./schema/mcp";
import * as schema from "./schema/mcp";

/**
 * Default apps that should be available to all users
 * These are the integrations that Backpack supports out of the box
 */
export const DEFAULT_APPS: Array<{
	id: string;
	name: string;
	description: string;
	transport: string[] | null;
	oauth: boolean;
	iconUrl: string;
	config: AppConfig;
	connectionType: string;
}> = [
	{
		"id": "brave",
		"name": "Brave Browser",
		"description": "Connect your Brave Browser history to view your browsing activity in your timeline.",
		"transport": [],
		"oauth": false,
		"iconUrl": "https://brave.com/static-assets/images/brave-logo-sans-text.svg",
		"config": {},
		"connectionType": "file"
	},
	{
		"id": "chrome",
		"name": "Google Chrome",
		"description": "Connect your Chrome browser history",
		"transport": [],
		"oauth": false,
		"iconUrl": "https://www.google.com/chrome/static/images/chrome-logo.svg",
		"config": {},
		"connectionType": "file"
	},
	{
		"id": "farcaster",
		"name": "Farcaster",
		"description": "A decentralized social network",
		"transport": null,
		"oauth": false,
		"iconUrl": "https://i.imgur.com/TXPOZfF.png",
		"config": {"url":"https://api.neynar.com","oas":"https://raw.githubusercontent.com/neynarxyz/OAS/refs/heads/main/src/api/spec.yaml"},
		"connectionType": "api"
	},
	{
		"id": "obsidian",
		"name": "Obsidian",
		"description": "Connect your Obsidian vault to see notes on your timeline and use AI to edit them.",
		"transport": [],
		"oauth": false,
		"iconUrl": "https://obsidian.md/images/obsidian-logo-gradient.svg",
		"config": {},
		"connectionType": "local"
	},
	{
		"id": "teller",
		"name": "Teller",
		"description": "Connect your bank accounts and view transaction history",
		"transport": [],
		"oauth": true,
		"iconUrl": "https://pbs.twimg.com/profile_images/1554659064562475008/zhb31S0g_400x400.jpg",
		"config": {"url": "https://api.teller.io"},
		"connectionType": "api"
	},
];

/**
 * Seed the database with default apps
 * Uses INSERT OR REPLACE to handle both fresh installs and updates
 */
export function seedDatabase(db: BunSQLiteDatabase<typeof schema>): void {
	const now = new Date();

	for (const app of DEFAULT_APPS) {
		db.insert(apps)
			.values({
				id: app.id,
				name: app.name,
				description: app.description,
				transport: app.transport,
				oauth: app.oauth,
				iconUrl: app.iconUrl,
				config: app.config,
				connectionType: app.connectionType,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: apps.id,
				set: {
					name: app.name,
					description: app.description,
					transport: app.transport,
					oauth: app.oauth,
					iconUrl: app.iconUrl,
					config: app.config,
					connectionType: app.connectionType,
					updatedAt: now,
				},
			})
			.run();
	}

	console.log(`[Seed] Seeded ${DEFAULT_APPS.length} default apps`);
}
