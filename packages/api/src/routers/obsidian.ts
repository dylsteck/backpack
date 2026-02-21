import { publicProcedure, router } from "../index";
import { z } from "zod";
import { listObsidianNotes, readObsidianNote, createObsidianNote } from "../services/obsidian";

export const obsidianRouter = router({
	listNotes: publicProcedure
		.input(
			z.object({
				limit: z.number().optional().default(20),
				search: z.string().optional(),
				folder: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			const result = await listObsidianNotes({
				limit: input.limit,
				search: input.search,
				folder: input.folder,
			});
			if (!result.success) {
				throw new Error(result.error);
			}
			return { notes: result.notes ?? [], totalNotes: result.totalNotes ?? 0 };
		}),

	readNote: publicProcedure
		.input(z.object({ notePath: z.string() }))
		.query(async ({ input }) => {
			const result = await readObsidianNote(input.notePath);
			if (!result.success) {
				throw new Error(result.error ?? "Failed to read note");
			}
			return result.note!;
		}),

	createNote: publicProcedure
		.input(
			z.object({
				title: z.string(),
				content: z.string(),
				tags: z.array(z.string()).optional(),
				folder: z.string().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const result = await createObsidianNote({
				title: input.title,
				content: input.content,
				tags: input.tags,
				folder: input.folder,
			});
			if (!result.success) {
				throw new Error(result.error ?? "Failed to create note");
			}
			return { success: true, message: result.message, notePath: result.notePath };
		}),
});
