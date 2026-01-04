import { ipcMain, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import {
	OBSIDIAN_SELECT_VAULT_CHANNEL,
	OBSIDIAN_READ_VAULT_CHANNEL,
	OBSIDIAN_READ_NOTE_CHANNEL,
	OBSIDIAN_CREATE_NOTE_CHANNEL,
	OBSIDIAN_UPDATE_NOTE_CHANNEL,
	OBSIDIAN_DELETE_NOTE_CHANNEL,
	OBSIDIAN_SEARCH_NOTES_CHANNEL,
} from "./obsidian-channels";

interface ObsidianNote {
	path: string;
	title: string;
	body: string;
	mtime: number;
	tags?: string[];
	backlinks?: string[];
}

/**
 * Extract tags from markdown content
 * Looks for #tags in content and tags in YAML frontmatter
 */
function extractTags(content: string): string[] {
	const tags: Set<string> = new Set();
	
	// Extract tags from frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch) {
		const frontmatter = frontmatterMatch[1];
		const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
		if (tagsMatch) {
			const tagList = tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''));
			tagList.forEach(t => t && tags.add(t));
		}
		// Also check for YAML list format
		const yamlTagsMatch = frontmatter.match(/tags:\s*\n((?:\s*-\s*.+\n)+)/);
		if (yamlTagsMatch) {
			const lines = yamlTagsMatch[1].split('\n');
			lines.forEach(line => {
				const tagMatch = line.match(/^\s*-\s*(.+)/);
				if (tagMatch) tags.add(tagMatch[1].trim().replace(/["']/g, ''));
			});
		}
	}
	
	// Extract inline #tags
	const inlineTags = content.match(/#[a-zA-Z][a-zA-Z0-9_-]*/g);
	if (inlineTags) {
		inlineTags.forEach(t => tags.add(t.substring(1)));
	}
	
	return Array.from(tags);
}

/**
 * Extract backlinks (wiki-style links) from markdown content
 */
function extractBacklinks(content: string): string[] {
	const links: Set<string> = new Set();
	const matches = content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
	for (const match of matches) {
		links.add(match[1]);
	}
	return Array.from(links);
}

/**
 * Get title from file (first heading or filename)
 */
function extractTitle(content: string, filePath: string): string {
	// Check for first heading
	const headingMatch = content.match(/^#\s+(.+)$/m);
	if (headingMatch) return headingMatch[1];
	
	// Check frontmatter title
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch) {
		const titleMatch = frontmatterMatch[1].match(/title:\s*["']?([^"'\n]+)["']?/);
		if (titleMatch) return titleMatch[1];
	}
	
	// Fall back to filename
	return path.basename(filePath, '.md');
}

/**
 * Recursively read all markdown files from a vault
 */
function readVaultNotes(vaultPath: string): ObsidianNote[] {
	const notes: ObsidianNote[] = [];
	
	function walkDir(dir: string) {
		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				
				// Skip hidden files and folders (like .obsidian)
				if (entry.name.startsWith('.')) continue;
				
				if (entry.isDirectory()) {
					walkDir(fullPath);
				} else if (entry.name.endsWith('.md')) {
					try {
						const content = fs.readFileSync(fullPath, 'utf-8');
						const stats = fs.statSync(fullPath);
						
						// Get body without frontmatter
						let body = content;
						const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n?/);
						if (frontmatterMatch) {
							body = content.substring(frontmatterMatch[0].length);
						}
						
						notes.push({
							path: fullPath,
							title: extractTitle(content, fullPath),
							body: body.trim().substring(0, 500), // Preview only
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
	
	// Sort by modification time (newest first)
	notes.sort((a, b) => b.mtime - a.mtime);
	
	return notes;
}

/**
 * Search notes by query string
 */
function searchNotes(vaultPath: string, query: string): ObsidianNote[] {
	const notes = readVaultNotes(vaultPath);
	const lowerQuery = query.toLowerCase();
	
	return notes.filter(note => 
		note.title.toLowerCase().includes(lowerQuery) ||
		note.body.toLowerCase().includes(lowerQuery) ||
		note.tags?.some(t => t.toLowerCase().includes(lowerQuery))
	);
}

export function addObsidianEventListeners() {
	// Select vault folder
	ipcMain.handle(OBSIDIAN_SELECT_VAULT_CHANNEL, async () => {
		try {
			const result = await dialog.showOpenDialog({
				properties: ['openDirectory'],
				title: 'Select Obsidian Vault',
				buttonLabel: 'Select Vault',
			});
			
			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, error: 'No folder selected' };
			}
			
			const vaultPath = result.filePaths[0];
			
			// Verify it looks like an Obsidian vault (has .obsidian folder or .md files)
			const hasObsidianFolder = fs.existsSync(path.join(vaultPath, '.obsidian'));
			const mdFiles = fs.readdirSync(vaultPath).filter(f => f.endsWith('.md'));
			
			if (!hasObsidianFolder && mdFiles.length === 0) {
				return { 
					success: false, 
					error: 'This folder does not appear to be an Obsidian vault (no .md files found)' 
				};
			}
			
			const notes = readVaultNotes(vaultPath);
			
			return { 
				success: true, 
				vaultPath,
				noteCount: notes.length,
			};
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	});
	
	// Read all notes from vault
	ipcMain.handle(OBSIDIAN_READ_VAULT_CHANNEL, (_event, vaultPath: string) => {
		try {
			if (!fs.existsSync(vaultPath)) {
				return { success: false, error: 'Vault path does not exist' };
			}
			
			const notes = readVaultNotes(vaultPath);
			return { success: true, notes, noteCount: notes.length };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	});
	
	// Read single note
	ipcMain.handle(OBSIDIAN_READ_NOTE_CHANNEL, (_event, notePath: string) => {
		try {
			if (!fs.existsSync(notePath)) {
				return { success: false, error: 'Note does not exist' };
			}
			
			const content = fs.readFileSync(notePath, 'utf-8');
			const stats = fs.statSync(notePath);
			
			return {
				success: true,
				note: {
					path: notePath,
					title: extractTitle(content, notePath),
					body: content, // Full content
					mtime: stats.mtime.getTime(),
					tags: extractTags(content),
					backlinks: extractBacklinks(content),
				}
			};
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	});
	
	// Create new note
	ipcMain.handle(OBSIDIAN_CREATE_NOTE_CHANNEL, (_event, vaultPath: string, title: string, content: string, frontmatter?: Record<string, unknown>) => {
		try {
			// Sanitize title for filename
			const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_');
			const notePath = path.join(vaultPath, `${safeTitle}.md`);
			
			if (fs.existsSync(notePath)) {
				return { success: false, error: 'A note with this title already exists' };
			}
			
			let fullContent = '';
			
			// Add frontmatter if provided
			if (frontmatter && Object.keys(frontmatter).length > 0) {
				fullContent = '---\n';
				for (const [key, value] of Object.entries(frontmatter)) {
					if (Array.isArray(value)) {
						fullContent += `${key}:\n`;
						value.forEach(v => fullContent += `  - ${v}\n`);
					} else {
						fullContent += `${key}: ${value}\n`;
					}
				}
				fullContent += '---\n\n';
			}
			
			fullContent += content;
			
			fs.writeFileSync(notePath, fullContent, 'utf-8');
			
			return { 
				success: true, 
				notePath,
				note: {
					path: notePath,
					title,
					body: content.substring(0, 500),
					mtime: Date.now(),
					tags: extractTags(fullContent),
					backlinks: extractBacklinks(fullContent),
				}
			};
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	});
	
	// Update existing note
	ipcMain.handle(OBSIDIAN_UPDATE_NOTE_CHANNEL, (_event, notePath: string, content: string, mode: 'replace' | 'append' | 'prepend') => {
		try {
			if (!fs.existsSync(notePath)) {
				return { success: false, error: 'Note does not exist' };
			}
			
			let newContent: string;
			
			if (mode === 'replace') {
				newContent = content;
			} else {
				const existingContent = fs.readFileSync(notePath, 'utf-8');
				if (mode === 'append') {
					newContent = existingContent + '\n\n' + content;
				} else { // prepend
					// Preserve frontmatter at top
					const frontmatterMatch = existingContent.match(/^(---\n[\s\S]*?\n---\n?)/);
					if (frontmatterMatch) {
						newContent = frontmatterMatch[1] + '\n' + content + '\n\n' + existingContent.substring(frontmatterMatch[0].length);
					} else {
						newContent = content + '\n\n' + existingContent;
					}
				}
			}
			
			fs.writeFileSync(notePath, newContent, 'utf-8');
			
			const stats = fs.statSync(notePath);
			
			return { 
				success: true,
				note: {
					path: notePath,
					title: extractTitle(newContent, notePath),
					body: newContent.substring(0, 500),
					mtime: stats.mtime.getTime(),
					tags: extractTags(newContent),
					backlinks: extractBacklinks(newContent),
				}
			};
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	});
	
	// Search notes
	ipcMain.handle(OBSIDIAN_SEARCH_NOTES_CHANNEL, (_event, vaultPath: string, query: string) => {
		try {
			if (!fs.existsSync(vaultPath)) {
				return { success: false, error: 'Vault path does not exist' };
			}

			const notes = searchNotes(vaultPath, query);
			return { success: true, notes };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	});

	// Delete note
	ipcMain.handle(OBSIDIAN_DELETE_NOTE_CHANNEL, (_event, notePath: string) => {
		try {
			if (!fs.existsSync(notePath)) {
				return { success: false, error: 'Note does not exist' };
			}

			// Move to trash instead of permanent delete (safer)
			const { shell } = require('electron');
			shell.trashItem(notePath);

			return { success: true };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	});
}

