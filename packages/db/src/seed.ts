import { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { apps, type AppConfig } from "./schema/mcp";
import * as schema from "./schema/mcp";

/**
 * Default apps that should be available to all users
 * These are the integrations that Cortex supports out of the box
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
		"id": "browserbase",
		"name": "Browserbase",
		"description": "Headless browser sessions for agents.",
		"transport": ["stdio"],
		"oauth": false,
		"iconUrl": "https://raw.githubusercontent.com/cursor/mcp-servers/main/servers/browserbase/icon.svg",
		"config": {"command":"npx","args":["@browserbasehq/mcp"],"env":{"BROWSERBASE_API_KEY":"","BROWSERBASE_PROJECT_ID":""}},
		"connectionType": "mcp"
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
		"id": "convex",
		"name": "Convex",
		"description": "Interact with your Convex deployment - query tables, run functions, manage environment variables, and analyze logs.",
		"transport": ["stdio"],
		"oauth": false,
		"iconUrl": "https://raw.githubusercontent.com/cursor/mcp-servers/main/servers/convex/icon.svg",
		"config": {"command":"npx","args":["-y","convex@latest","mcp","start"]},
		"connectionType": "mcp"
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
		"id": "figma",
		"name": "Figma",
		"description": "Design and collaboration platform for teams.",
		"transport": ["sse"],
		"oauth": false,
		"iconUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Figma-logo.svg/1365px-Figma-logo.svg.png",
		"config": {"url":"https://mcp.figma.com/mcp"},
		"connectionType": "mcp"
	},
	{
		"id": "instantdb",
		"name": "InstantDB",
		"description": "Query and manage InstantDB.",
		"transport": ["sse"],
		"oauth": false,
		"iconUrl": "https://raw.githubusercontent.com/cursor/mcp-servers/main/servers/instantdb/icon.svg",
		"config": {"url":"https://mcp.instantdb.com/mcp"},
		"connectionType": "mcp"
	},
	{
		"id": "linear",
		"name": "Linear",
		"description": "Issue tracking and project management for development teams.",
		"transport": ["stdio","sse"],
		"oauth": true,
		"iconUrl": "https://i.imgur.com/kht78ut.png",
		"config": {"url":"https://mcp.linear.app/sse"},
		"connectionType": "mcp"
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
		"id": "notion",
		"name": "Notion",
		"description": "All-in-one workspace for notes, docs, and project management.",
		"transport": ["sse"],
		"oauth": true,
		"iconUrl": "https://raw.githubusercontent.com/cursor/mcp-servers/main/servers/notion/icon.svg",
		"config": {"url":"https://mcp.notion.com/mcp"},
		"connectionType": "mcp"
	},
	{
		"id": "railway",
		"name": "Railway",
		"description": "Deploy apps, databases, and services.",
		"transport": ["stdio"],
		"oauth": false,
		"iconUrl": "https://raw.githubusercontent.com/cursor/mcp-servers/main/servers/railway/icon.svg",
		"config": {"command":"npx","args":["-y","@railway/mcp-server"]},
		"connectionType": "mcp"
	},
	{
		"id": "shopify",
		"name": "Shopify",
		"description": "Shopify app development tools.",
		"transport": ["stdio"],
		"oauth": false,
		"iconUrl": "https://raw.githubusercontent.com/cursor/mcp-servers/main/servers/shopify/icon.svg",
		"config": {"command":"npx","args":["-y","@shopify/dev-mcp@latest"]},
		"connectionType": "mcp"
	},
	{
		"id": "supabase",
		"name": "Supabase",
		"description": "Create and manage Supabase projects.",
		"transport": ["sse"],
		"oauth": true,
		"iconUrl": "https://raw.githubusercontent.com/cursor/mcp-servers/main/servers/supabase/icon.svg",
		"config": {"url":"https://mcp.supabase.com/mcp"},
		"connectionType": "mcp"
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
	{
		"id": "vercel",
		"name": "Vercel",
		"description": "Manage projects and deployments on Vercel.",
		"transport": ["sse"],
		"oauth": true,
		"iconUrl": "https://raw.githubusercontent.com/cursor/mcp-servers/main/servers/vercel/icon.svg",
		"config": {"url":"https://mcp.vercel.com"},
		"connectionType": "mcp"
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
