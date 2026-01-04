/**
 * Obsidian Tools for AI Chat
 * Tools for reading, creating, and updating Obsidian vault notes
 */

import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { getDatabase, connections } from "@cortex/db";
import { eq } from "drizzle-orm";

// Helper to get the Obsidian vault path from the database
async function getObsidianVaultPath(): Promise<string | null> {
	try {
		const db = getDatabase();
		const connection = await db
			.select()
			.from(connections)
			.where(eq(connections.serverId, "obsidian"))
			.get();

		if (connection?.connectionMetadata) {
			const metadata = connection.connectionMetadata as { localPath?: string };
			return metadata.localPath || null;
		}
		return null;
	} catch {
		return null;
	}
}

// Helper to extract tags from markdown content
function extractTags(content: string): string[] {
	const tags: Set<string> = new Set();

	// Extract tags from frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch && frontmatterMatch[1]) {
		const frontmatter = frontmatterMatch[1];
		const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
		if (tagsMatch && tagsMatch[1]) {
			const tagList = tagsMatch[1].split(",").map((t) => t.trim().replace(/["']/g, ""));
			tagList.forEach((t) => t && tags.add(t));
		}
	}

	// Extract inline #tags
	const inlineTags = content.match(/#[a-zA-Z][a-zA-Z0-9_-]*/g);
	if (inlineTags) {
		inlineTags.forEach((t) => tags.add(t.substring(1)));
	}

	return Array.from(tags);
}

// Helper to extract backlinks
function extractBacklinks(content: string): string[] {
	const links: Set<string> = new Set();
	const matches = content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
	for (const match of matches) {
		if (match[1]) {
			links.add(match[1]);
		}
	}
	return Array.from(links);
}

// Helper to get title from note
function extractTitle(content: string, filePath: string): string {
	const headingMatch = content.match(/^#\s+(.+)$/m);
	if (headingMatch && headingMatch[1]) {
		return headingMatch[1];
	}

	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch && frontmatterMatch[1]) {
		const titleMatch = frontmatterMatch[1].match(/title:\s*["']?([^"'\n]+)["']?/);
		if (titleMatch && titleMatch[1]) {
			return titleMatch[1];
		}
	}

	return path.basename(filePath, ".md");
}

// Obsidian Note interface
interface ObsidianNote {
	path: string;
	title: string;
	body: string;
	mtime: number;
	tags?: string[];
	backlinks?: string[];
}

// Walk directory recursively
function readVaultNotes(vaultPath: string): ObsidianNote[] {
	const notes: ObsidianNote[] = [];

	function walkDir(dir: string) {
		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.name.startsWith(".")) continue;

				if (entry.isDirectory()) {
					walkDir(fullPath);
				} else if (entry.name.endsWith(".md")) {
					try {
						const content = fs.readFileSync(fullPath, "utf-8");
						const stats = fs.statSync(fullPath);

						let body = content;
						const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n?/);
						if (frontmatterMatch) {
							body = content.substring(frontmatterMatch[0].length);
						}

						notes.push({
							path: fullPath,
							title: extractTitle(content, fullPath),
							body: body.trim().substring(0, 500),
							mtime: stats.mtime.getTime(),
							tags: extractTags(content),
							backlinks: extractBacklinks(content),
						});
					} catch (error) {
						console.error(`Failed to read note: ${fullPath}`, error);
					}
				}
			}
		} catch (error) {
			console.error(`Failed to read directory: ${dir}`, error);
		}
	}

	walkDir(vaultPath);
	notes.sort((a, b) => b.mtime - a.mtime);
	return notes;
}

// ============================================
// Tool Definitions
// ============================================

/**
 * List notes in the Obsidian vault
 */
export const obsidianListNotesTool = tool({
	description:
		"List all notes in the connected Obsidian vault. Returns note titles, paths, and preview text. Use this to see what notes exist. Can filter by folder name (e.g., 'Clippings', 'Notes', etc.).",
	inputSchema: z.object({
		limit: z.number().optional().default(20).describe("Maximum number of notes to return"),
		search: z.string().optional().describe("Optional search query to filter notes by title or content"),
		folder: z.string().optional().describe("Optional folder name to filter notes by (e.g., 'Clippings', 'Notes'). Case-insensitive partial matching."),
	}),
	execute: async ({ limit, search, folder }) => {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected. Please connect an Obsidian vault first.",
			};
		}

		let notes = readVaultNotes(vaultPath);

		// Filter by folder if specified
		if (folder) {
			const lowerFolder = folder.toLowerCase();
			notes = notes.filter((n) => {
				// Get relative path from vault root
				const relativePath = path.relative(vaultPath, n.path);
				const folderPath = path.dirname(relativePath);
				// Check if folder name matches (case-insensitive, partial match)
				return folderPath.toLowerCase().includes(lowerFolder) || 
				       relativePath.toLowerCase().includes(lowerFolder);
			});
		}

		if (search) {
			const lowerSearch = search.toLowerCase();
			notes = notes.filter(
				(n) =>
					n.title.toLowerCase().includes(lowerSearch) ||
					n.body.toLowerCase().includes(lowerSearch) ||
					n.tags?.some((t) => t.toLowerCase().includes(lowerSearch))
			);
		}

		return {
			success: true,
			notes: notes.slice(0, limit).map((n) => {
				const relativePath = path.relative(vaultPath, n.path);
				const folderPath = path.dirname(relativePath);
				return {
					title: n.title,
					path: n.path,
					folder: folderPath === '.' ? 'root' : folderPath,
					preview: n.body.substring(0, 200),
					tags: n.tags,
					lastModified: new Date(n.mtime).toISOString(),
				};
			}),
			totalNotes: notes.length,
		};
	},
});

/**
 * Read a specific note from the Obsidian vault
 */
export const obsidianReadNoteTool = tool({
	description:
		"Read the full content of a specific note from the Obsidian vault. Use this when you need to see the complete text of a note.",
	inputSchema: z.object({
		notePath: z.string().describe("The full path to the note file, or just the note title"),
	}),
	execute: async ({ notePath }) => {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
			};
		}

		// If notePath doesn't include the vault path, try to find the note
		let fullPath = notePath;
		if (!fs.existsSync(notePath)) {
			// Search for the note by title
			const notes = readVaultNotes(vaultPath);
			const found = notes.find(
				(n) => n.title.toLowerCase() === notePath.toLowerCase() || n.path.endsWith(`${notePath}.md`)
			);
			if (found) {
				fullPath = found.path;
			} else {
				return {
					success: false,
					error: `Note not found: ${notePath}`,
				};
			}
		}

		try {
			const content = fs.readFileSync(fullPath, "utf-8");
			const stats = fs.statSync(fullPath);

			return {
				success: true,
				note: {
					path: fullPath,
					title: extractTitle(content, fullPath),
					content,
					tags: extractTags(content),
					backlinks: extractBacklinks(content),
					lastModified: stats.mtime.toISOString(),
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: `Failed to read note: ${error.message}`,
			};
		}
	},
});

/**
 * Create a new note in the Obsidian vault
 */
export const obsidianCreateNoteTool = tool({
	description:
		"Create a new note in the Obsidian vault. Use this when the user wants to save something or create a new note.",
	inputSchema: z.object({
		title: z.string().describe("The title/filename for the new note (without .md extension)"),
		content: z.string().describe("The content of the note in Markdown format"),
		tags: z.array(z.string()).optional().describe("Optional array of tags to add to the note frontmatter"),
		folder: z.string().optional().describe("Optional subfolder within the vault to create the note in"),
	}),
	execute: async ({ title, content, tags, folder }) => {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
			};
		}

		// Sanitize title for filename
		const safeTitle = title.replace(/[<>:"/\\|?*]/g, "_");
		const targetDir = folder ? path.join(vaultPath, folder) : vaultPath;
		const notePath = path.join(targetDir, `${safeTitle}.md`);

		if (fs.existsSync(notePath)) {
			return {
				success: false,
				error: `A note with title "${title}" already exists.`,
			};
		}

		// Ensure target directory exists
		if (folder && !fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		// Build note content with optional frontmatter
		let fullContent = "";
		if (tags && tags.length > 0) {
			fullContent = "---\n";
			fullContent += `tags:\n`;
			tags.forEach((t) => (fullContent += `  - ${t}\n`));
			fullContent += "---\n\n";
		}
		fullContent += content;

		try {
			fs.writeFileSync(notePath, fullContent, "utf-8");

			return {
				success: true,
				message: `Created note: ${title}`,
				notePath,
			};
		} catch (error: any) {
			return {
				success: false,
				error: `Failed to create note: ${error.message}`,
			};
		}
	},
});

/**
 * Update an existing note in the Obsidian vault
 */
export const obsidianUpdateNoteTool = tool({
	description:
		"Update an existing note in the Obsidian vault. Can append, prepend, or replace the content.",
	inputSchema: z.object({
		notePath: z.string().describe("The path or title of the note to update"),
		content: z.string().describe("The content to add or replace"),
		mode: z
			.enum(["append", "prepend", "replace"])
			.default("append")
			.describe("How to update: append (add to end), prepend (add to start), or replace (overwrite)"),
	}),
	execute: async ({ notePath, content, mode }) => {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
			};
		}

		// Find the note
		let fullPath = notePath;
		if (!fs.existsSync(notePath)) {
			const notes = readVaultNotes(vaultPath);
			const found = notes.find(
				(n) => n.title.toLowerCase() === notePath.toLowerCase() || n.path.endsWith(`${notePath}.md`)
			);
			if (found) {
				fullPath = found.path;
			} else {
				return {
					success: false,
					error: `Note not found: ${notePath}`,
				};
			}
		}

		try {
			let newContent: string;

			if (mode === "replace") {
				newContent = content;
			} else {
				const existingContent = fs.readFileSync(fullPath, "utf-8");
				if (mode === "append") {
					newContent = existingContent + "\n\n" + content;
				} else {
					// prepend - preserve frontmatter
					const frontmatterMatch = existingContent.match(/^(---\n[\s\S]*?\n---\n?)/);
					if (frontmatterMatch) {
						newContent =
							frontmatterMatch[1] + "\n" + content + "\n\n" + existingContent.substring(frontmatterMatch[0].length);
					} else {
						newContent = content + "\n\n" + existingContent;
					}
				}
			}

			fs.writeFileSync(fullPath, newContent, "utf-8");

			return {
				success: true,
				message: `Updated note: ${path.basename(fullPath, ".md")}`,
				notePath: fullPath,
			};
		} catch (error: any) {
			return {
				success: false,
				error: `Failed to update note: ${error.message}`,
			};
		}
	},
});

/**
 * Add a backlink (wikilink) to a note
 */
export const obsidianAddBacklinkTool = tool({
	description:
		"Add a [[wikilink]] backlink to an existing note, connecting it to another note.",
	inputSchema: z.object({
		notePath: z.string().describe("The path or title of the note to add the backlink to"),
		targetNote: z.string().describe("The title of the note to link to"),
		context: z.string().optional().describe("Optional context text to add around the link"),
	}),
	execute: async ({ notePath, targetNote, context }) => {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
			};
		}

		// Find the note
		let fullPath = notePath;
		if (!fs.existsSync(notePath)) {
			const notes = readVaultNotes(vaultPath);
			const found = notes.find(
				(n) => n.title.toLowerCase() === notePath.toLowerCase() || n.path.endsWith(`${notePath}.md`)
			);
			if (found) {
				fullPath = found.path;
			} else {
				return {
					success: false,
					error: `Note not found: ${notePath}`,
				};
			}
		}

		try {
			const existingContent = fs.readFileSync(fullPath, "utf-8");
			const link = `[[${targetNote}]]`;
			const textToAdd = context ? `${context} ${link}` : link;
			const newContent = existingContent + "\n\n" + textToAdd;

			fs.writeFileSync(fullPath, newContent, "utf-8");

			return {
				success: true,
				message: `Added backlink to ${targetNote}`,
				notePath: fullPath,
			};
		} catch (error: any) {
			return {
				success: false,
				error: `Failed to add backlink: ${error.message}`,
			};
		}
	},
});

/**
 * Search notes in the vault
 */
export const obsidianSearchTool = tool({
	description:
		"Search through Obsidian vault notes by content, title, or tags. Use this to find specific information in your notes. Can filter by folder name.",
	inputSchema: z.object({
		query: z.string().describe("The search query"),
		searchIn: z
			.enum(["all", "titles", "content", "tags"])
			.default("all")
			.describe("Where to search: all, titles, content, or tags"),
		limit: z.number().optional().default(10).describe("Maximum results to return"),
		folder: z.string().optional().describe("Optional folder name to filter notes by (e.g., 'Clippings', 'Notes'). Case-insensitive partial matching."),
	}),
	execute: async ({ query, searchIn, limit, folder }) => {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
			};
		}

		let notes = readVaultNotes(vaultPath);
		
		// Filter by folder if specified
		if (folder) {
			const lowerFolder = folder.toLowerCase();
			notes = notes.filter((n) => {
				const relativePath = path.relative(vaultPath, n.path);
				const folderPath = path.dirname(relativePath);
				return folderPath.toLowerCase().includes(lowerFolder) || 
				       relativePath.toLowerCase().includes(lowerFolder);
			});
		}
		
		const lowerQuery = query.toLowerCase();

		const filtered = notes.filter((note) => {
			switch (searchIn) {
				case "titles":
					return note.title.toLowerCase().includes(lowerQuery);
				case "content":
					return note.body.toLowerCase().includes(lowerQuery);
				case "tags":
					return note.tags?.some((t) => t.toLowerCase().includes(lowerQuery));
				default: // all
					return (
						note.title.toLowerCase().includes(lowerQuery) ||
						note.body.toLowerCase().includes(lowerQuery) ||
						note.tags?.some((t) => t.toLowerCase().includes(lowerQuery))
					);
			}
		});

		return {
			success: true,
			results: filtered.slice(0, limit).map((n) => {
				const relativePath = path.relative(vaultPath, n.path);
				const folderPath = path.dirname(relativePath);
				return {
					title: n.title,
					path: n.path,
					folder: folderPath === '.' ? 'root' : folderPath,
					preview: n.body.substring(0, 200),
					tags: n.tags,
					lastModified: new Date(n.mtime).toISOString(),
				};
			}),
			totalFound: filtered.length,
		};
	},
});

// Export all Obsidian tools
export const obsidianTools = {
	obsidian_list_notes: obsidianListNotesTool,
	obsidian_read_note: obsidianReadNoteTool,
	obsidian_create_note: obsidianCreateNoteTool,
	obsidian_update_note: obsidianUpdateNoteTool,
	obsidian_add_backlink: obsidianAddBacklinkTool,
	obsidian_search: obsidianSearchTool,
};

