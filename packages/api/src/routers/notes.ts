import { publicProcedure, router } from "../index";
import { z } from "zod";
import { getDatabase, items } from "@cortex/db";
import { eq, and, desc } from "drizzle-orm";

export const notesRouter = router({
	// Create a new note
	create: publicProcedure
		.input(
			z.object({
				body: z.string().min(1),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const db = getDatabase();
				const now = new Date();
				const noteId = `note_${crypto.randomUUID()}`;

				await db.insert(items).values({
					id: noteId,
					source: "user",
					type: "note",
					timestamp: now,
					data: { body: input.body },
					createdAt: now,
					updatedAt: now,
				});

				return {
					success: true,
					note: {
						id: noteId,
						source: "user",
						type: "note",
						timestamp: now,
						data: { body: input.body },
					},
				};
			} catch (error) {
				console.error("Error creating note:", error);
				throw new Error("Failed to create note");
			}
		}),

	// List all notes
	list: publicProcedure
		.input(
			z.object({
				limit: z.number().optional().default(50),
				cursor: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			try {
				const db = getDatabase();

				const notes = await db
					.select()
					.from(items)
					.where(and(eq(items.source, "user"), eq(items.type, "note")))
					.orderBy(desc(items.timestamp))
					.limit(input.limit + 1);

				const hasMore = notes.length > input.limit;
				const results = hasMore ? notes.slice(0, -1) : notes;
				const nextCursor = hasMore && results.length > 0 
					? results[results.length - 1]?.id 
					: undefined;

				return {
					notes: results.map((note) => ({
						id: note.id,
						source: note.source,
						type: note.type,
						timestamp: note.timestamp,
						data: note.data as { body: string },
					})),
					nextCursor,
				};
			} catch (error) {
				console.error("Error listing notes:", error);
				return { notes: [], nextCursor: undefined };
			}
		}),

	// Delete a note
	delete: publicProcedure
		.input(
			z.object({
				id: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const db = getDatabase();
				await db.delete(items).where(eq(items.id, input.id));
				return { success: true };
			} catch (error) {
				console.error("Error deleting note:", error);
				throw new Error("Failed to delete note");
			}
		}),
});

