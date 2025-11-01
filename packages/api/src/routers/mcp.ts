import { publicProcedure, router } from "../index";
import { z } from "zod";
import { db, connections, apps } from "@cortex/db";
import { eq } from "drizzle-orm";

const transportConfigSchema = z.object({
	command: z.string().optional(),
	args: z.array(z.string()).optional(),
	url: z.string().optional(),
	headers: z.record(z.string()).optional(),
	env: z.record(z.string()).optional(),
});

export const mcpRouter = router({
	// Get all available servers from database
	getAvailableServers: publicProcedure.query(async () => {
		try {
			const servers = await db.select().from(apps);
			
			return {
				servers: servers.map((server) => ({
					id: server.id,
					name: server.name,
					description: server.description,
					transport: server.transport,
					oauth: server.oauth,
					iconUrl: server.iconUrl,
					config: server.config,
					connectionType: server.connectionType,
				})),
			};
		} catch (error) {
			console.error("Error in getAvailableServers:", error);
			return { servers: [] };
		}
	}),

	// Get all MCP connections
	getUserConnections: publicProcedure.query(async () => {
		const connectionList = await db
			.select()
			.from(connections);

		return connectionList;
	}),

	// Add a new MCP connection
	addConnection: publicProcedure
		.input(
			z.object({
				serverId: z.string(),
				serverName: z.string(),
				vendor: z.string().optional(),
				transportType: z.enum(["stdio", "http", "https", "sse", "streamable-http"]),
				transportConfig: transportConfigSchema,
			})
		)
		.mutation(async ({ input }) => {
			const id = crypto.randomUUID();
			const now = new Date();

			const [connection] = await db
				.insert(connections)
				.values({
					id,
					serverId: input.serverId,
					serverName: input.serverName,
					vendor: input.vendor || null,
					transportType: input.transportType,
					transportConfig: input.transportConfig,
					status: "connected",
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			return connection;
		}),

	// Update an existing MCP connection
	updateConnection: publicProcedure
		.input(
			z.object({
				id: z.string(),
				transportConfig: transportConfigSchema.optional(),
				status: z.enum(["connected", "disconnected", "error"]).optional(),
			})
		)
		.mutation(async ({ input }) => {
			const now = new Date();

			const [connection] = await db
				.update(connections)
				.set({
					transportConfig: input.transportConfig,
					status: input.status,
					updatedAt: now,
				})
				.where(eq(connections.id, input.id))
				.returning();

			return connection;
		}),

	// Remove an MCP connection
	removeConnection: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			await db
				.delete(connections)
				.where(eq(connections.id, input.id));

			return { success: true };
		}),
});

