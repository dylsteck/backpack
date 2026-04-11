import * as fs from "fs";
import * as path from "path";
import { getDatabase, connections } from "@backpack/db";
import { eq } from "drizzle-orm";

export interface ObsidianNote {
	path: string;
	title: string;
	content: string;
	folder: string;
	preview: string;
	tags: string[];
	backlinks: string[];
	lastModified: string;
}

export interface ListNotesOptions {
	limit?: number;
	search?: string;
	folder?: string;
}

export interface ListNotesResult {
	success: boolean;
	notes: ObsidianNote[];
	totalNotes: number;
	error?: string;
}

export interface ReadNoteResult {
	success: boolean;
	note?: ObsidianNote;
	error?: string;
	suggestions?: string[];
}

export interface CreateNoteOptions {
	tags?: string[];
	folder?: string;
}

export interface CreateNoteResult {
	success: boolean;
	message?: string;
	notePath?: string;
	error?: string;
}

export interface UpdateNoteResult {
	success: boolean;
	message?: string;
	notePath?: string;
	error?: string;
}

export interface AddBacklinkResult {
	success: boolean;
	message?: string;
	notePath?: string;
	error?: string;
}

export interface SearchOptions {
	searchIn?: "all" | "titles" | "content" | "tags";
	limit?: number;
	folder?: string;
}

export interface SearchResult {
	success: boolean;
	results: ObsidianNote[];
	totalFound: number;
	error?: string;
}

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

function extractTags(content: string): string[] {
	const tags: Set<string> = new Set();

	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch && frontmatterMatch[1]) {
		const frontmatter = frontmatterMatch[1];
		const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
		if (tagsMatch && tagsMatch[1]) {
			const tagList = tagsMatch[1].split(",").map((t) => t.trim().replace(/["']/g, ""));
			tagList.forEach((t) => t && tags.add(t));
		}
	}

	const inlineTags = content.match(/#[a-zA-Z][a-zA-Z0-9_-]*/g);
	if (inlineTags) {
		inlineTags.forEach((t) => tags.add(t.substring(1)));
	}

	return Array.from(tags);
}

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

interface VaultNote {
	path: string;
	title: string;
	body: string;
	mtime: number;
	tags?: string[];
	backlinks?: string[];
}

function readVaultNotes(vaultPath: string): VaultNote[] {
	const notes: VaultNote[] = [];

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

export class ObsidianService {
	async listNotes(opts?: ListNotesOptions): Promise<ListNotesResult> {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected. Please connect an Obsidian vault first.",
				notes: [],
				totalNotes: 0,
			};
		}

		let notes = readVaultNotes(vaultPath);

		if (opts?.folder) {
			const lowerFolder = opts.folder.toLowerCase();
			notes = notes.filter((n) => {
				const relativePath = path.relative(vaultPath, n.path);
				const folderPath = path.dirname(relativePath);
				return (
					folderPath.toLowerCase().includes(lowerFolder) ||
					relativePath.toLowerCase().includes(lowerFolder)
				);
			});
		}

		if (opts?.search) {
			const lowerSearch = opts.search.toLowerCase();
			notes = notes.filter(
				(n) =>
					n.title.toLowerCase().includes(lowerSearch) ||
					n.body.toLowerCase().includes(lowerSearch) ||
					n.tags?.some((t) => t.toLowerCase().includes(lowerSearch))
			);
		}

		const limit = opts?.limit ?? 20;
		const totalNotes = notes.length;
		const limitedNotes = notes.slice(0, limit);

		return {
			success: true,
			notes: limitedNotes.map((n) => {
				const relativePath = path.relative(vaultPath, n.path);
				const folderPath = path.dirname(relativePath);
				return {
					path: n.path,
					title: n.title,
					content: "",
					folder: folderPath === "." ? "root" : folderPath,
					preview: n.body.substring(0, 200),
					tags: n.tags || [],
					backlinks: n.backlinks || [],
					lastModified: new Date(n.mtime).toISOString(),
				};
			}),
			totalNotes,
		};
	}

	async readNote(notePath: string): Promise<ReadNoteResult> {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
			};
		}

		let fullPath = notePath;
		if (!fs.existsSync(notePath)) {
			const notes = readVaultNotes(vaultPath);

			const searchTitle = notePath
				.replace(/^.*\//, "")
				.replace(/\.md$/i, "")
				.toLowerCase();

			let found = notes.find(
				(n) => n.title.toLowerCase() === searchTitle || n.path.endsWith(`${notePath}.md`)
			);

			if (!found) {
				found = notes.find((n) => n.title.toLowerCase().includes(searchTitle));
			}

			if (!found) {
				const firstWord = searchTitle.split(/[\s\-_]/)[0];
				if (firstWord && firstWord.length > 2) {
					found = notes.find((n) => n.title.toLowerCase().includes(firstWord));
				}
			}

			if (found) {
				fullPath = found.path;
			} else {
				const searchWords = searchTitle.split(/[\s\-_]/).filter((w) => w.length > 2);
				const similar = notes
					.filter((n) => searchWords.some((word) => n.title.toLowerCase().includes(word)))
					.slice(0, 3)
					.map((n) => n.title);

				return {
					success: false,
					error: `Note not found: ${notePath}`,
					suggestions: similar.length > 0 ? similar : undefined,
				};
			}
		}

		try {
			const content = fs.readFileSync(fullPath, "utf-8");
			const stats = fs.statSync(fullPath);
			const relativePath = path.relative(vaultPath, fullPath);
			const folderPath = path.dirname(relativePath);

			return {
				success: true,
				note: {
					path: fullPath,
					title: extractTitle(content, fullPath),
					content,
					folder: folderPath === "." ? "root" : folderPath,
					preview: content.substring(0, 200),
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
	}

	async createNote(
		title: string,
		content: string,
		opts?: CreateNoteOptions
	): Promise<CreateNoteResult> {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
			};
		}

		const safeTitle = title.replace(/[<>:"/\\|?*]/g, "_");
		const targetDir = opts?.folder ? path.join(vaultPath, opts.folder) : vaultPath;
		const notePath = path.join(targetDir, `${safeTitle}.md`);

		if (fs.existsSync(notePath)) {
			return {
				success: false,
				error: `A note with title "${title}" already exists.`,
			};
		}

		if (opts?.folder && !fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		let fullContent = "";
		if (opts?.tags && opts.tags.length > 0) {
			fullContent = "---\n";
			fullContent += `tags:\n`;
			opts.tags.forEach((t) => (fullContent += `  - ${t}\n`));
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
	}

	async updateNote(
		notePath: string,
		content: string,
		mode: "append" | "prepend" | "replace"
	): Promise<UpdateNoteResult> {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
			};
		}

		let fullPath = notePath;
		if (!fs.existsSync(notePath)) {
			const notes = readVaultNotes(vaultPath);
			const found = notes.find(
				(n) =>
					n.title.toLowerCase() === notePath.toLowerCase() ||
					n.path.endsWith(`${notePath}.md`)
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
					const frontmatterMatch = existingContent.match(/^(---\n[\s\S]*?\n---\n?)/);
					if (frontmatterMatch) {
						newContent =
							frontmatterMatch[1] +
							"\n" +
							content +
							"\n\n" +
							existingContent.substring(frontmatterMatch[0].length);
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
	}

	async addBacklink(
		notePath: string,
		targetNote: string,
		context?: string
	): Promise<AddBacklinkResult> {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
			};
		}

		let fullPath = notePath;
		if (!fs.existsSync(notePath)) {
			const notes = readVaultNotes(vaultPath);
			const found = notes.find(
				(n) =>
					n.title.toLowerCase() === notePath.toLowerCase() ||
					n.path.endsWith(`${notePath}.md`)
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
	}

	async search(query: string, opts?: SearchOptions): Promise<SearchResult> {
		const vaultPath = await getObsidianVaultPath();
		if (!vaultPath) {
			return {
				success: false,
				error: "No Obsidian vault connected.",
				results: [],
				totalFound: 0,
			};
		}

		let notes = readVaultNotes(vaultPath);

		if (opts?.folder) {
			const lowerFolder = opts.folder.toLowerCase();
			notes = notes.filter((n) => {
				const relativePath = path.relative(vaultPath, n.path);
				const folderPath = path.dirname(relativePath);
				return (
					folderPath.toLowerCase().includes(lowerFolder) ||
					relativePath.toLowerCase().includes(lowerFolder)
				);
			});
		}

		const lowerQuery = query.toLowerCase();
		const searchIn = opts?.searchIn ?? "all";

		const filtered = notes.filter((note) => {
			switch (searchIn) {
				case "titles":
					return note.title.toLowerCase().includes(lowerQuery);
				case "content":
					return note.body.toLowerCase().includes(lowerQuery);
				case "tags":
					return note.tags?.some((t) => t.toLowerCase().includes(lowerQuery));
				default:
					return (
						note.title.toLowerCase().includes(lowerQuery) ||
						note.body.toLowerCase().includes(lowerQuery) ||
						note.tags?.some((t) => t.toLowerCase().includes(lowerQuery))
					);
			}
		});

		const limit = opts?.limit ?? 10;
		const totalFound = filtered.length;
		const results = filtered.slice(0, limit);

		return {
			success: true,
			results: results.map((n) => {
				const relativePath = path.relative(vaultPath, n.path);
				const folderPath = path.dirname(relativePath);
				return {
					path: n.path,
					title: n.title,
					content: "",
					folder: folderPath === "." ? "root" : folderPath,
					preview: n.body.substring(0, 200),
					tags: n.tags || [],
					backlinks: n.backlinks || [],
					lastModified: new Date(n.mtime).toISOString(),
				};
			}),
			totalFound,
		};
	}
}
