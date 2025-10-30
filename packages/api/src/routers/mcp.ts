import { protectedProcedure, publicProcedure, router } from "../index";
import { z } from "zod";
import { db, mcpConnection, mcpServerRegistry } from "@cortex/db";
import { eq, and } from "drizzle-orm";

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
			const servers = await db.select().from(mcpServerRegistry);
			
			return {
				servers: servers.map((server) => ({
					id: server.id,
					name: server.name,
					description: server.description,
					transport: server.transport,
					oauth: server.oauth,
					iconUrl: server.iconUrl,
					config: server.config,
					domains: server.domains,
				})),
			};
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
				transportType: z.enum(["stdio", "http", "https", "sse", "streamable-http"]),
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

