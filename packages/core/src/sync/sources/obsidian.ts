/**
 * Obsidian vault syncer - syncs markdown notes to timeline
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { ObsidianConfig, SourceType } from "../../config/schema.js";
import { BaseSyncer } from "../base.js";
import type { SyncProgress } from "../types.js";
import type { TimelineItem } from "../../types/index.js";
import * as schema from "@backpack/db/schema/core";

/**
 * Parsed frontmatter from markdown file
 */
interface Frontmatter {
  title?: string;
  tags?: string[];
  created?: string;
  [key: string]: unknown;
}

/**
 * Parsed markdown file
 */
interface ParsedNote {
  frontmatter: Frontmatter;
  body: string;
  wikilinks: string[];
  tags: string[];
  filePath: string;
  relativePath: string;
  mtime: Date;
  birthtime: Date;
}

/**
 * Raw data stored in timeline item
 */
interface ObsidianRawData {
  frontmatter: Frontmatter;
  wikilinks: string[];
  tags: string[];
  filePath: string;
  mtime: number;
  fileSize: number;
}

/**
 * Obsidian vault syncer
 */
export class ObsidianSyncer extends BaseSyncer {
  readonly name: SourceType = "obsidian";
  protected declare config?: ObsidianConfig;

  constructor(
    db: BunSQLiteDatabase<typeof schema>,
    config?: ObsidianConfig
  ) {
    super(db, config);
    this.config = config;
  }

  /**
   * Check if vault path is configured and exists
   */
  async isConfigured(): Promise<boolean> {
    if (!this.config?.vaultPath) {
      return false;
    }

    try {
      const stats = await fs.promises.stat(this.config.vaultPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Validate configuration by testing file read
   */
  async validateConfig(): Promise<boolean> {
    if (!await this.isConfigured()) {
      return false;
    }

    try {
      // Try to read directory contents
      const files = await fs.promises.readdir(this.config!.vaultPath);
      // Try to read first markdown file if exists
      const mdFile = files.find((f) => f.endsWith(".md"));
      if (mdFile) {
        await fs.promises.readFile(
          path.join(this.config!.vaultPath, mdFile),
          "utf-8"
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Main sync implementation
   */
  protected async doSync(progress: SyncProgress): Promise<SyncProgress> {
    const vaultPath = this.config!.vaultPath;

    // Get list of markdown files
    const files = await this.walkVault(vaultPath);
    progress.itemsFound = files.length;
    this.updateProgress(progress);

    // Process each file
    for (const filePath of files) {
      try {
        await this.processFile(filePath, vaultPath, progress);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.errors.push(`Failed to process ${filePath}: ${errorMessage}`);
        this.updateProgress(progress);
      }
    }

    return progress;
  }

  /**
   * Walk vault directory recursively and find all markdown files
   */
  private async walkVault(vaultPath: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(vaultPath, fullPath);

        // Skip hidden files/directories
        if (entry.name.startsWith(".")) {
          continue;
        }

        // Apply include/exclude patterns if configured
        if (this.shouldSkipPath(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          files.push(fullPath);
        }
      }
    };

    await walk(vaultPath);
    return files;
  }

  /**
   * Check if path should be skipped based on patterns
   */
  private shouldSkipPath(relativePath: string): boolean {
    // Check exclude patterns first
    if (this.config?.excludePatterns) {
      for (const pattern of this.config.excludePatterns) {
        if (this.matchesPattern(relativePath, pattern)) {
          return true;
        }
      }
    }

    // If include patterns specified, only include matching files
    if (this.config?.includePatterns && this.config.includePatterns.length > 0) {
      for (const pattern of this.config.includePatterns) {
        if (this.matchesPattern(relativePath, pattern)) {
          return false;
        }
      }
      // No include pattern matched, skip
      return true;
    }

    return false;
  }

  /**
   * Simple pattern matching (supports * wildcards)
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    return regex.test(filePath);
  }

  /**
   * Process a single markdown file
   */
  private async processFile(
    filePath: string,
    vaultPath: string,
    _progress: SyncProgress
  ): Promise<void> {
    // Get file stats
    const stats = await fs.promises.stat(filePath);
    const relativePath = path.relative(vaultPath, filePath);

    // Check if file has changed (incremental sync)
    const existingItem = await this.getExistingItem(relativePath);
    if (existingItem?.rawData) {
      const rawData = existingItem.rawData as unknown as ObsidianRawData;
      if (rawData.mtime === stats.mtime.getTime()) {
        // File unchanged, skip
        return;
      }
    }

    // Read and parse file
    const content = await fs.promises.readFile(filePath, "utf-8");
    const parsed = this.parseNote(content, filePath, relativePath, stats);

    // Create timeline item
    const item: TimelineItem = {
      id: existingItem?.id || crypto.randomUUID(),
      source: "obsidian",
      type: "note",
      externalId: relativePath,
      title: parsed.frontmatter.title || this.getFileName(relativePath),
      content: parsed.body,
      rawData: {
        frontmatter: parsed.frontmatter,
        wikilinks: parsed.wikilinks,
        tags: parsed.tags,
        filePath: relativePath,
        mtime: stats.mtime.getTime(),
        fileSize: stats.size,
      } as unknown as Record<string, unknown>,
      url: `file://${filePath}`,
      timestamp: this.parseDate(parsed.frontmatter.created) || parsed.birthtime,
      createdAt: existingItem?.createdAt || new Date(),
      updatedAt: stats.mtime,
      syncStatus: "synced",
    };

    // Save to database
    await this.saveItem(item);
  }

  /**
   * Get existing item from database by file path
   */
  private async getExistingItem(relativePath: string): Promise<TimelineItem | null> {
    const { timelineItems } = await import("@backpack/db/schema/core");
    const { eq, and } = await import("drizzle-orm");

    const result = await this.db.query.timelineItems.findFirst({
      where: and(
        eq(timelineItems.source, "obsidian"),
        eq(timelineItems.externalId, relativePath)
      ),
    });

    if (!result) return null;

    return {
      id: result.id,
      source: result.source as SourceType,
      type: result.type as TimelineItem["type"],
      externalId: result.externalId || undefined,
      title: result.title || undefined,
      content: result.content || undefined,
      rawData: result.rawData ? JSON.parse(result.rawData) : undefined,
      url: result.url || undefined,
      timestamp: result.timestamp,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      syncStatus: result.syncStatus as TimelineItem["syncStatus"],
      errorMessage: result.errorMessage || undefined,
    };
  }

  /**
   * Parse markdown note content
   */
  private parseNote(
    content: string,
    filePath: string,
    relativePath: string,
    stats: fs.Stats
  ): ParsedNote {
    // Parse frontmatter
    const { frontmatter, body } = this.parseFrontmatter(content);

    // Extract wikilinks
    const wikilinks = this.extractWikilinks(body);

    // Extract tags
    const tags = this.extractTags(body);

    // Merge frontmatter tags
    if (frontmatter.tags) {
      const fmTags = Array.isArray(frontmatter.tags)
        ? frontmatter.tags
        : [frontmatter.tags];
      for (const tag of fmTags) {
        if (typeof tag === "string" && !tags.includes(tag)) {
          tags.push(tag);
        }
      }
    }

    return {
      frontmatter,
      body,
      wikilinks,
      tags,
      filePath,
      relativePath,
      mtime: stats.mtime,
      birthtime: stats.birthtime,
    };
  }

  /**
   * Parse YAML frontmatter from markdown
   * Simple parser - supports basic YAML structure
   */
  private parseFrontmatter(content: string): {
    frontmatter: Frontmatter;
    body: string;
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const frontmatterText = match[1];
    if (!frontmatterText) {
      return { frontmatter: {}, body: content };
    }
    
    const body = content.slice(match[0].length);

    const frontmatter: Frontmatter = {};

    // Simple YAML parsing (line by line)
    const lines = frontmatterText.split("\n");
    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Try to parse arrays
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string if parsing fails
        }
      }

      // Try to parse booleans
      if (value === "true") value = true;
      if (value === "false") value = false;

      // Try to parse numbers
      if (typeof value === "string" && /^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }

      frontmatter[key] = value;
    }

    return { frontmatter, body };
  }

  /**
   * Extract wikilinks from content [[Link]] or [[Link|Alias]]
   */
  private extractWikilinks(content: string): string[] {
    const wikilinkRegex = /\[\[(.*?)\]\]/g;
    const links: string[] = [];
    let match;

    while ((match = wikilinkRegex.exec(content)) !== null) {
      // Handle [[Link|Alias]] format - just take the link part
      const linkContent = match[1];
      if (!linkContent) continue;
      const link = linkContent.split("|")[0]?.trim();
      if (link && !links.includes(link)) {
        links.push(link);
      }
    }

    return links;
  }

  /**
   * Extract tags from content #tag
   */
  private extractTags(content: string): string[] {
    // Match hashtags that are standalone or at word boundaries
    // Don't match inside code blocks or URLs
    const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-\/]+)/g;
    const tags: string[] = [];
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const tag = match[1];
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Get file name without extension
   */
  private getFileName(relativePath: string): string {
    const basename = path.basename(relativePath, ".md");
    return basename.replace(/[-_]/g, " ");
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateValue: unknown): Date | null {
    if (!dateValue) return null;

    if (dateValue instanceof Date) {
      return dateValue;
    }

    if (typeof dateValue === "string") {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    if (typeof dateValue === "number") {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }
}
