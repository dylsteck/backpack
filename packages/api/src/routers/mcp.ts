import { protectedProcedure, publicProcedure, router } from "../index";
import { z } from "zod";
import { db, mcpConnection } from "@cortex/db";
import { eq, and } from "drizzle-orm";

const transportConfigSchema = z.object({
	command: z.string().optional(),
	args: z.array(z.string()).optional(),
	url: z.string().optional(),
	headers: z.record(z.string()).optional(),
});

export const mcpRouter = router({
	// Get all available servers from the MCP registry via server route
	getAvailableServers: publicProcedure.query(async () => {
		try {
			// Fetch from our server's MCP route which has caching
			const serverUrl = process.env.SERVER_URL || "http://localhost:3000";
			const response = await fetch(`${serverUrl}/api/mcp/servers`);
			
			if (!response.ok) {
				console.error("Server MCP route failed:", response.status, response.statusText);
				throw new Error("Failed to fetch MCP servers from server");
			}
			
			const data = await response.json();
			console.log("MCP servers fetched:", data);
			
			// Ensure we return the expected structure
			if (!data || !data.servers) {
				console.warn("Invalid data structure from server:", data);
				return { servers: [] };
			}
			
			return data;
		} catch (error) {
			console.error("Error in getAvailableServers:", error);
			return { servers: [] };
		}
	}),

	// Get user's connected MCP servers
	getUserConnections: protectedProcedure.query(async ({ ctx }) => {
		const connections = await db
			.select()
			.from(mcpConnection)
			.where(eq(mcpConnection.userId, ctx.session.user.id));

		return connections;
	}),

	// Add a new MCP connection
	addConnection: protectedProcedure
		.input(
			z.object({
				serverId: z.string(),
				serverName: z.string(),
				vendor: z.string().optional(),
				transportType: z.enum(["stdio", "http", "sse"]),
				transportConfig: transportConfigSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const id = crypto.randomUUID();
			const now = new Date();

			const [connection] = await db
				.insert(mcpConnection)
				.values({
					id,
					userId: ctx.session.user.id,
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
	updateConnection: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				transportConfig: transportConfigSchema.optional(),
				status: z.enum(["connected", "disconnected", "error"]).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const now = new Date();

			const [connection] = await db
				.update(mcpConnection)
				.set({
					transportConfig: input.transportConfig,
					status: input.status,
					updatedAt: now,
				})
				.where(
					and(
						eq(mcpConnection.id, input.id),
						eq(mcpConnection.userId, ctx.session.user.id)
					)
				)
				.returning();

			return connection;
		}),

	// Remove an MCP connection
	removeConnection: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await db
				.delete(mcpConnection)
				.where(
					and(
						eq(mcpConnection.id, input.id),
						eq(mcpConnection.userId, ctx.session.user.id)
					)
				);

			return { success: true };
		}),
});

