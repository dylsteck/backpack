/**
 * Hybrid search - semantic (QMD) + full-text (SQLite)
 */

import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "@backpack/db/schema/core";
import { eq, and, gte, lte, inArray, sql, desc } from "drizzle-orm";
import { searchVectors, isQmdAvailable } from "../embeddings/qmd.js";
import type { SearchOptions, SearchResponse, SearchResult } from "./types.js";
import type { TimelineItem } from "../types/index.js";

/**
 * Normalize score to 0-1 range
 */
function normalizeScore(score: number, _type: "semantic" | "fulltext"): number {
  if (score <= 0) return 0;
  if (score >= 1) return 1;
  return Math.min(1, Math.max(0, score));
}

/**
 * Extract highlight snippets containing query terms
 */
function calculateHighlight(
  item: { title?: string | null; content?: string | null },
  query: string
): string[] {
  const text = [item.title, item.content].filter(Boolean).join(" ");
  if (!text || !query) return [];

  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const highlights: string[] = [];
  const sentences = text.split(/[.!?]\s+/);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (terms.some((t) => lower.includes(t))) {
      const snippet = sentence.trim().slice(0, 120);
      if (snippet && !highlights.includes(snippet)) {
        highlights.push(snippet);
        if (highlights.length >= 3) break;
      }
    }
  }

  return highlights;
}

/**
 * Map DB row to TimelineItem
 */
function rowToItem(row: Record<string, unknown>): TimelineItem {
  return {
    id: String(row.id),
    source: row.source as TimelineItem["source"],
    type: row.type as TimelineItem["type"],
    externalId: row.externalId ? String(row.externalId) : undefined,
    title: row.title ? String(row.title) : undefined,
    content: row.content ? String(row.content) : undefined,
    rawData: row.rawData ? (typeof row.rawData === "string" ? {} : (row.rawData as Record<string, unknown>)) : undefined,
    url: row.url ? String(row.url) : undefined,
    timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(Number(row.timestamp)) as unknown as Date,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(Number(row.createdAt)) as unknown as Date,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(Number(row.updatedAt)) as unknown as Date,
    syncStatus: (row.syncStatus as TimelineItem["syncStatus"]) ?? "pending",
    errorMessage: row.errorMessage ? String(row.errorMessage) : undefined,
  };
}

/**
 * Search timeline items - hybrid semantic + full-text
 */
export async function search(
  db: BunSQLiteDatabase<typeof schema>,
  options: SearchOptions
): Promise<SearchResponse> {
  const startTime = Date.now();
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const useSemantic = options.useSemantic !== false;
  const useFullText = options.useFullText !== false;
  const query = options.query?.trim() ?? "";
  const filters = options.filters ?? {};

  const resultsMap = new Map<string, SearchResult>();

  // Empty query: return recent items
  if (!query) {
    const conditions = [];
    if (filters.sources?.length) {
      conditions.push(inArray(schema.timelineItems.source, filters.sources));
    }
    if (filters.startDate) {
      conditions.push(gte(schema.timelineItems.timestamp, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.timelineItems.timestamp, filters.endDate));
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const items = await db.query.timelineItems.findMany({
      where,
      orderBy: [desc(schema.timelineItems.timestamp)],
      limit: limit * 2,
      offset,
    });

    const results: SearchResult[] = items.slice(0, limit).map((item) => ({
      item: rowToItem(item as unknown as Record<string, unknown>),
      score: 1,
      matchType: "fulltext" as const,
      highlights: [],
    }));

    return {
      results,
      total: results.length,
      query: "",
      durationMs: Date.now() - startTime,
    };
  }

  // Semantic search via QMD
  if (useSemantic) {
    try {
      const qmdAvailable = await isQmdAvailable();
      if (qmdAvailable) {
        const vectorResults = await searchVectors(query, limit * 2);
        for (const vr of vectorResults) {
          const item = await db.query.timelineItems.findFirst({
            where: eq(schema.timelineItems.id, vr.id),
          });
          if (item) {
            const timelineItem = rowToItem(item as unknown as Record<string, unknown>);
            resultsMap.set(vr.id, {
              item: timelineItem,
              score: normalizeScore(vr.score, "semantic"),
              matchType: "semantic",
              highlights: calculateHighlight(item, query),
            });
          }
        }
      }
    } catch (err) {
      console.warn("Semantic search failed:", err);
    }
  }

  // Full-text search via SQLite LIKE
  if (useFullText) {
    const likePattern = `%${query}%`;
    const conditions: Parameters<typeof and> = [
      sql`(${schema.timelineItems.title} LIKE ${likePattern} OR ${schema.timelineItems.content} LIKE ${likePattern})`,
    ];
    if (filters.sources?.length) {
      conditions.push(inArray(schema.timelineItems.source, filters.sources));
    }
    if (filters.startDate) {
      conditions.push(gte(schema.timelineItems.timestamp, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.timelineItems.timestamp, filters.endDate));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
    const ftsItems = await db.query.timelineItems.findMany({
      where: whereClause,
      orderBy: [desc(schema.timelineItems.timestamp)],
      limit: limit * 2,
    });

    for (const item of ftsItems) {
      const existing = resultsMap.get(item.id);
      const timelineItem = rowToItem(item as unknown as Record<string, unknown>);
      const score = normalizeScore(0.7, "fulltext");
      const highlights = calculateHighlight(item, query);

      if (existing) {
        existing.matchType = "both";
        existing.score = (existing.score + score) / 2;
        existing.highlights = existing.highlights?.length ? existing.highlights : highlights;
      } else {
        resultsMap.set(item.id, {
          item: timelineItem,
          score,
          matchType: "fulltext",
          highlights,
        });
      }
    }
  }

  // Sort by score and apply limit/offset
  const sorted = Array.from(resultsMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(offset, offset + limit);

  return {
    results: sorted,
    total: sorted.length,
    query,
    durationMs: Date.now() - startTime,
  };
}
