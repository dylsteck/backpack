import { publicProcedure, router } from "../index";
import { z } from "zod";
import { getDatabase, comments } from "@cortex/db";
import { eq, asc } from "drizzle-orm";

export const commentsRouter = router({
	// Create a new comment for an item
	create: publicProcedure
		.input(
			z.object({
				itemId: z.string(),
				content: z.string().min(1),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const db = getDatabase();
				const now = new Date();
				const commentId = `comment_${crypto.randomUUID()}`;

				await db.insert(comments).values({
					id: commentId,
					itemId: input.itemId,
					content: input.content,
					createdAt: now,
				});

				return {
					success: true,
					comment: {
						id: commentId,
						itemId: input.itemId,
						content: input.content,
						createdAt: now,
					},
				};
			} catch (error) {
				console.error("Error creating comment:", error);
				throw new Error("Failed to create comment");
			}
		}),

	// List comments for an item
	listByItem: publicProcedure
		.input(
			z.object({
				itemId: z.string(),
			})
		)
		.query(async ({ input }) => {
			try {
				const db = getDatabase();

				const results = await db
					.select()
					.from(comments)
					.where(eq(comments.itemId, input.itemId))
					.orderBy(asc(comments.createdAt));

				return {
					comments: results.map((c) => ({
						id: c.id,
						itemId: c.itemId,
						content: c.content,
						createdAt: c.createdAt,
					})),
				};
			} catch (error) {
				console.error("Error listing comments:", error);
				return { comments: [] };
			}
		}),

	// Delete a comment
	delete: publicProcedure
		.input(
			z.object({
				id: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const db = getDatabase();
				await db.delete(comments).where(eq(comments.id, input.id));
				return { success: true };
			} catch (error) {
				console.error("Error deleting comment:", error);
				throw new Error("Failed to delete comment");
			}
		}),
});

