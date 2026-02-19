/**
 * Embedding orchestration - generates embeddings for timeline items via QMD
 */

import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../db/schema.js";
import { indexItems, isQmdAvailable } from "./qmd.js";

const BATCH_SIZE = 100;

/**
 * Extract text from timeline item for embedding
 */
export function extractEmbeddingText(item: {
  source: string;
  title?: string | null;
  content?: string | null;
  rawData?: string | null;
  url?: string | null;
}): string {
  let text = "";

  switch (item.source) {
    case "obsidian":
      text = [item.title, item.content].filter(Boolean).join(" ");
      break;
    case "farcaster":
      text = item.content || item.title || "";
      break;
    case "teller":
      try {
        const raw = item.rawData ? JSON.parse(item.rawData) : {};
        const desc = raw?.transaction?.description || raw?.description || "";
        text = [item.title, desc].filter(Boolean).join(" ");
      } catch {
        text = item.title || item.content || "";
      }
      break;
    case "chrome":
    case "brave":
      text = [item.title, item.url].filter(Boolean).join(" ");
      break;
    default:
      text = item.content || item.title || "";
  }

  return (text || "untitled").trim();
}

/**
 * Generate embeddings for specific items
 */
export async function generateEmbeddings(
  db: BunSQLiteDatabase<typeof schema>,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return;

  const available = await isQmdAvailable();
  if (!available) {
    console.warn("QMD not found in PATH - skipping embeddings. Install: bun install -g qmd");
    return;
  }

  const items = await db.query.timelineItems.findMany({
    where: (items, { inArray }) => inArray(items.id, itemIds),
  });

  const toEmbed = items
    .map((item) => {
      const text = extractEmbeddingText(item);
      if (!text || text === "untitled") return null;
      return { id: item.id, text };
    })
    .filter((x): x is { id: string; text: string } => x !== null);

  if (toEmbed.length === 0) return;

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    await indexItems(batch);
  }
}

/**
 * Generate embeddings for all items that don't have them yet
 * Uses embeddings table to track - items with no embedding row need embedding
 */
export async function generateForNewItems(
  db: BunSQLiteDatabase<typeof schema>
): Promise<void> {
  const available = await isQmdAvailable();
  if (!available) {
    return;
  }

  // Get items that don't have embeddings
  const allItems = await db.query.timelineItems.findMany({
    columns: { id: true, source: true, title: true, content: true, rawData: true, url: true },
  });

  const embeddedIds = new Set(
    (await db.query.embeddings.findMany({ columns: { itemId: true } })).map((e) => e.itemId)
  );

  const toEmbed = allItems
    .filter((item) => !embeddedIds.has(item.id))
    .map((item) => {
      const text = extractEmbeddingText(item);
      if (!text || text === "untitled") return null;
      return { id: item.id, text };
    })
    .filter((x): x is { id: string; text: string } => x !== null);

  if (toEmbed.length === 0) {
    return;
  }

  console.log(`Generating embeddings for ${toEmbed.length} new items...`);

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    await indexItems(batch);

    // Record in embeddings table (minimal - QMD stores the actual vectors)
    const now = Date.now();
    await db.insert(schema.embeddings).values(
      batch.map((item) => ({
        id: `emb-${item.id}-${now}`,
        itemId: item.id,
        model: "text-embedding-3-small",
        createdAt: new Date(now),
      }))
    );
  }

  console.log("Embeddings complete.");
}

export { searchVectors, isQmdAvailable } from "./qmd.js";
