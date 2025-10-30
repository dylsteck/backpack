#!/usr/bin/env bun

import { db, mcpServerRegistry } from "@cortex/db";
import { eq } from "drizzle-orm";

const CURSOR_REPO_BASE = "https://raw.githubusercontent.com/cursor/mcp-servers/main";

interface CursorServerConfig {
	url?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	headers?: Record<string, string>;
}

interface CursorServerJson {
	name: string;
	description: string;
	transport: string[];
	oauth?: boolean;
	icon: string;
	config?: CursorServerConfig;
	domains?: string[];
}

async function syncCursorServers() {
	console.log("🔄 Starting Cursor MCP servers sync...");

	try {
		// Fetch index.json to get list of server IDs
		const indexResponse = await fetch(`${CURSOR_REPO_BASE}/servers/index.json`);
		if (!indexResponse.ok) {
			throw new Error(`Failed to fetch index.json: ${indexResponse.statusText}`);
		}
		const serverIds: string[] = await indexResponse.json();
		console.log(`📋 Found ${serverIds.length} servers to sync`);

		// Fetch and process each server
		const servers = [];
		for (const serverId of serverIds) {
			try {
				const serverResponse = await fetch(
					`${CURSOR_REPO_BASE}/servers/${serverId}/server.json`
				);
				if (!serverResponse.ok) {
					console.warn(`⚠️  Failed to fetch ${serverId}: ${serverResponse.statusText}`);
					continue;
				}

				const serverJson: CursorServerJson = await serverResponse.json();
				const iconUrl = `${CURSOR_REPO_BASE}/servers/${serverId}/icon.svg`;

				const server = {
					id: serverId,
					name: serverJson.name,
					description: serverJson.description,
					transport: serverJson.transport || [],
					oauth: serverJson.oauth || false,
					iconUrl: iconUrl,
					config: serverJson.config || {},
					domains: serverJson.domains || null,
					lastUpdated: new Date(),
				};

				servers.push(server);
			} catch (error) {
				console.error(`❌ Error processing ${serverId}:`, error);
			}
		}

		console.log(`✅ Successfully fetched ${servers.length} servers`);

		// Upsert all servers into database
		let inserted = 0;
		let updated = 0;

		for (const server of servers) {
			try {
				await db
					.insert(mcpServerRegistry)
					.values(server)
					.onConflictDoUpdate({
						target: mcpServerRegistry.id,
						set: {
							name: server.name,
							description: server.description,
							transport: server.transport,
							oauth: server.oauth,
							iconUrl: server.iconUrl,
							config: server.config,
							domains: server.domains,
							lastUpdated: server.lastUpdated,
						},
					});
				inserted++;
			} catch (error) {
				console.error(`❌ Error upserting ${server.id}:`, error);
			}
		}

		console.log(`✨ Sync complete! Processed ${servers.length} servers`);
		console.log(`   - Inserted/Updated: ${inserted}`);
	} catch (error) {
		console.error("❌ Sync failed:", error);
		process.exit(1);
	}
}

if (import.meta.main) {
	syncCursorServers()
		.then(() => {
			console.log("🎉 Done!");
			process.exit(0);
		})
		.catch((error) => {
			console.error("💥 Fatal error:", error);
			process.exit(1);
		});
}

