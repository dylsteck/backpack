import { publicProcedure, router } from "../index";
import { z } from "zod";
import { getDatabase, chatSessions, chatMessages } from "@cortex/db";
import { eq, desc, asc } from "drizzle-orm";

export const chatRouter = router({
	// Create a new chat session
	createSession: publicProcedure
		.input(
			z.object({
				title: z.string().optional(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const db = getDatabase();
				const now = new Date();
				const sessionId = `chat_${crypto.randomUUID()}`;

				await db.insert(chatSessions).values({
					id: sessionId,
					title: input.title || null,
					createdAt: now,
					updatedAt: now,
				});

				return {
					success: true,
					session: {
						id: sessionId,
						title: input.title || null,
						createdAt: now,
						updatedAt: now,
					},
				};
			} catch (error) {
				console.error("Error creating chat session:", error);
				throw new Error("Failed to create chat session");
			}
		}),

	// Add a message to a session
	// Content can be plain text or JSON (for storing tool calls/results from AI SDK)
	addMessage: publicProcedure
		.input(
			z.object({
				sessionId: z.string(),
				role: z.enum(["user", "assistant", "tool"]),
				content: z.string(), // Can be plain text or JSON-stringified AI SDK message content
				metadata: z.record(z.unknown()).optional(), // Optional metadata for tool calls, etc.
			})
		)
		.mutation(async ({ input }) => {
			try {
				const db = getDatabase();
				const now = new Date();
				const messageId = `msg_${crypto.randomUUID()}`;

				// If metadata is provided, merge it into content as JSON
				let finalContent = input.content;
				if (input.metadata && Object.keys(input.metadata).length > 0) {
					try {
						// Try to parse content as JSON and merge with metadata
						const parsed = JSON.parse(input.content);
						finalContent = JSON.stringify({ ...parsed, _metadata: input.metadata });
					} catch {
						// Content is plain text, wrap it with metadata
						finalContent = JSON.stringify({ text: input.content, _metadata: input.metadata });
					}
				}

				// Insert the message
				await db.insert(chatMessages).values({
					id: messageId,
					sessionId: input.sessionId,
					role: input.role,
					content: finalContent,
					createdAt: now,
				});

				// Update session title if this is the first user message
				if (input.role === "user") {
					const session = await db
						.select()
						.from(chatSessions)
						.where(eq(chatSessions.id, input.sessionId))
						.limit(1);

					if (session[0] && !session[0].title) {
						// Set title to first 50 chars of first user message (use plain text)
						const titleText = input.content.slice(0, 50) + (input.content.length > 50 ? "..." : "");
						await db
							.update(chatSessions)
							.set({ title: titleText, updatedAt: now })
							.where(eq(chatSessions.id, input.sessionId));
					} else {
						// Just update the timestamp
						await db
							.update(chatSessions)
							.set({ updatedAt: now })
							.where(eq(chatSessions.id, input.sessionId));
					}
				}

				return {
					success: true,
					message: {
						id: messageId,
						sessionId: input.sessionId,
						role: input.role,
						content: finalContent,
						createdAt: now,
					},
				};
			} catch (error) {
				console.error("Error adding chat message:", error);
				throw new Error("Failed to add chat message");
			}
		}),

	// Get all sessions (for chat tab)
	getSessions: publicProcedure
		.input(
			z.object({
				limit: z.number().optional().default(50),
			})
		)
		.query(async ({ input }) => {
			try {
				const db = getDatabase();

				const sessions = await db
					.select()
					.from(chatSessions)
					.orderBy(desc(chatSessions.updatedAt))
					.limit(input.limit);

				return {
					sessions: sessions.map((s) => ({
						id: s.id,
						title: s.title,
						createdAt: s.createdAt,
						updatedAt: s.updatedAt,
					})),
				};
			} catch (error) {
				console.error("Error getting chat sessions:", error);
				return { sessions: [] };
			}
		}),

	// Get a single session with all messages
	getSession: publicProcedure
		.input(
			z.object({
				sessionId: z.string(),
			})
		)
		.query(async ({ input }) => {
			try {
				const db = getDatabase();

				const session = await db
					.select()
					.from(chatSessions)
					.where(eq(chatSessions.id, input.sessionId))
					.limit(1);

				if (!session[0]) {
					throw new Error("Session not found");
				}

				const messages = await db
					.select()
					.from(chatMessages)
					.where(eq(chatMessages.sessionId, input.sessionId))
					.orderBy(asc(chatMessages.createdAt));

				return {
					session: {
						id: session[0].id,
						title: session[0].title,
						createdAt: session[0].createdAt,
						updatedAt: session[0].updatedAt,
					},
					messages: messages.map((m) => ({
						id: m.id,
						role: m.role as "user" | "assistant" | "tool",
						content: m.content,
						createdAt: m.createdAt,
					})),
				};
			} catch (error) {
				console.error("Error getting chat session:", error);
				throw new Error("Failed to get chat session");
			}
		}),

	// Delete a session and all its messages
	deleteSession: publicProcedure
		.input(
			z.object({
				sessionId: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const db = getDatabase();
				// Messages will be deleted via CASCADE
				await db.delete(chatSessions).where(eq(chatSessions.id, input.sessionId));
				return { success: true };
			} catch (error) {
				console.error("Error deleting chat session:", error);
				throw new Error("Failed to delete chat session");
			}
		}),
});

