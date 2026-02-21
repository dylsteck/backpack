import * as fs from "fs";
import * as path from "path";
import { getDatabase, connections } from "@cortex/db";
import { eq } from "drizzle-orm";

export interface ObsidianNoteInfo {
	path: string;
	title: string;
	folder: string;
	preview: string;
	tags: string[];
	lastModified: string;
}

export interface ObsidianNoteFull {
	path: string;
	title: string;
	content: string;
	tags: string[];
	backlinks: string[];
	lastModified: string;
}

async function getObsidianVaultPath(): Promise<string | null> {
	try {
		const db = getDatabase();
		const [connection] = await db
			.select()
			.from(connections)
			.where(eq(connections.serverId, "obsidian"))
			.limit(1);

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
		const tagsMatch = frontmatterMatch[1].match(/tags:\s*\[(.*?)\]/);
		if (tagsMatch && tagsMatch[1]) {
			tagsMatch[1]
				.split(",")
				.map((t) => t.trim().replace(/["']/g, ""))
				.forEach((t) => t && tags.add(t));
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
		if (match[1]) links.add(match[1]);
	}
	return Array.from(links);
}

function extractTitle(content: string, filePath: string): string {
	const headingMatch = content.match(/^#\s+(.+)$/m);
	if (headingMatch?.[1]) return headingMatch[1];
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch?.[1]) {
		const titleMatch = frontmatterMatch[1].match(/title:\s*["']?([^"'\n]+)["']?/);
		if (titleMatch?.[1]) return titleMatch[1];
	}
	return path.basename(filePath, ".md");
}

function readVaultNotes(vaultPath: string): ObsidianNoteFull[] {
	const notes: ObsidianNoteFull[] = [];

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
						notes.push({
							path: fullPath,
							title: extractTitle(content, fullPath),
							content,
							tags: extractTags(content),
							backlinks: extractBacklinks(content),
							lastModified: stats.mtime.toISOString(),
						});
					} catch {
						// Skip unreadable files
					}
				}
			}
		} catch {
			// Skip unreadable dirs
		}
	}

	walkDir(vaultPath);
	notes.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
	return notes;
}

export async function listObsidianNotes(opts: {
	limit?: number;
	search?: string;
	folder?: string;
}): Promise<{ success: boolean; notes?: ObsidianNoteInfo[]; totalNotes?: number; error?: string }> {
	const vaultPath = await getObsidianVaultPath();
	if (!vaultPath) {
		return { success: false, error: "No Obsidian vault connected. Please connect an Obsidian vault first." };
	}

	let notes = readVaultNotes(vaultPath);

	if (opts.folder) {
		const lowerFolder = opts.folder.toLowerCase();
		notes = notes.filter((n) => {
			const relativePath = path.relative(vaultPath, n.path);
			const folderPath = path.dirname(relativePath);
			return folderPath.toLowerCase().includes(lowerFolder) || relativePath.toLowerCase().includes(lowerFolder);
		});
	}

	if (opts.search) {
		const lowerSearch = opts.search.toLowerCase();
		notes = notes.filter(
			(n) =>
				n.title.toLowerCase().includes(lowerSearch) ||
				n.content.toLowerCase().includes(lowerSearch) ||
				n.tags.some((t) => t.toLowerCase().includes(lowerSearch))
		);
	}

	const limit = opts.limit ?? 20;
	const sliced = notes.slice(0, limit).map((n) => {
		const relativePath = path.relative(vaultPath, n.path);
		const folderPath = path.dirname(relativePath);
		return {
			title: n.title,
			path: n.path,
			folder: folderPath === "." ? "root" : folderPath,
			preview: n.content.substring(0, 200),
			tags: n.tags,
			lastModified: n.lastModified,
		};
	});

	return { success: true, notes: sliced, totalNotes: notes.length };
}

export async function readObsidianNote(
	notePath: string
): Promise<{ success: boolean; note?: ObsidianNoteFull; error?: string; suggestions?: string[] }> {
	const vaultPath = await getObsidianVaultPath();
	if (!vaultPath) {
		return { success: false, error: "No Obsidian vault connected." };
	}

	let fullPath = notePath;
	if (!fs.existsSync(notePath)) {
		const notes = readVaultNotes(vaultPath);
		const searchTitle = notePath.replace(/^.*\//, "").replace(/\.md$/i, "").toLowerCase();
		let found = notes.find((n) => n.title.toLowerCase() === searchTitle || n.path.endsWith(`${notePath}.md`));
		if (!found) found = notes.find((n) => n.title.toLowerCase().includes(searchTitle));
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
			return { success: false, error: `Note not found: ${notePath}`, suggestions: similar.length > 0 ? similar : undefined };
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
	} catch (err: unknown) {
		return { success: false, error: `Failed to read note: ${err instanceof Error ? err.message : String(err)}` };
	}
}

export async function createObsidianNote(opts: {
	title: string;
	content: string;
	tags?: string[];
	folder?: string;
}): Promise<{ success: boolean; message?: string; notePath?: string; error?: string }> {
	const vaultPath = await getObsidianVaultPath();
	if (!vaultPath) {
		return { success: false, error: "No Obsidian vault connected." };
	}

	const safeTitle = opts.title.replace(/[<>:"/\\|?*]/g, "_");
	const targetDir = opts.folder ? path.join(vaultPath, opts.folder) : vaultPath;
	const notePath = path.join(targetDir, `${safeTitle}.md`);

	if (fs.existsSync(notePath)) {
		return { success: false, error: `A note with title "${opts.title}" already exists.` };
	}

	if (opts.folder && !fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}

	let fullContent = "";
	if (opts.tags && opts.tags.length > 0) {
		fullContent = "---\ntags:\n";
		opts.tags.forEach((t) => (fullContent += `  - ${t}\n`));
		fullContent += "---\n\n";
	}
	fullContent += opts.content;

	try {
		fs.writeFileSync(notePath, fullContent, "utf-8");
		return { success: true, message: `Created note: ${opts.title}`, notePath };
	} catch (err: unknown) {
		return { success: false, error: `Failed to create note: ${err instanceof Error ? err.message : String(err)}` };
	}
}
