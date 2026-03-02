/**
 * AI Tools for Chat
 * Item search tool for querying saved items
 */

import { tool } from "ai";
import { z } from "zod";
import { ItemsService } from "./services/items/service";
import { executeRawQuery, getDatabaseSchema } from "@backpack/db";
import { obsidianTools } from "./tools/obsidian";
import { browserTools } from "./tools/browser";

// Define the input schema
const searchItemsSchema = z.object({
    query: z
        .string()
        .optional()
        .describe("Text to search for in item content"),
    source: z
        .enum(["farcaster", "teller"])
        .optional()
        .describe(
            "Filter by source: 'farcaster' for social posts, 'teller' for transactions"
        ),
    type: z
        .enum(["cast", "transaction"])
        .optional()
        .describe("Filter by type"),
    limit: z
        .number()
        .optional()
        .default(50)
        .describe("Maximum number of items to return"),
});

// Item type for proper typing
interface Item {
    id: string;
    source: string;
    type: string;
    timestamp: Date;
    data: Record<string, unknown>;
}

/**
 * Search through saved items (Farcaster casts, Teller transactions, etc.)
 */
export const searchItemsTool = tool({
    description:
        "Search through saved items like Farcaster casts and bank transactions. Use this when the user asks about their saved content, posts, spending, or wants to find specific items.",
    inputSchema: searchItemsSchema,
    execute: async (
        input: z.infer<typeof searchItemsSchema>
    ): Promise<{ items: Array<{ id: string; source: string; type: string; timestamp: string; data: Record<string, unknown> }>; totalFound: number; available?: string }> => {
        const { query, source, type, limit } = input;
        const itemsService = new ItemsService();
        const result = await itemsService.getItems({
            source,
            type,
            limit: limit || 50,
        });

        // Filter by query if provided (simple text match)
        let items: Item[] = result.items;
        if (query) {
            const lowerQuery = query.toLowerCase();
            items = items.filter((item: Item) => {
                const dataStr = JSON.stringify(item.data).toLowerCase();
                return dataStr.includes(lowerQuery);
            });
        }

        // If no results, include a summary of what data IS available
        if (items.length === 0) {
            const summary = await itemsService.getSourceSummary();
            return {
                items: [],
                totalFound: 0,
                available: summary,
            };
        }

        return {
            items: items.map((item: Item) => ({
                id: item.id,
                source: item.source,
                type: item.type,
                timestamp: item.timestamp.toISOString(),
                data: item.data,
            })),
            totalFound: items.length,
        };
    },
});

/**
 * Analyze ALL items from a source - returns aggregated statistics and sample items
 */
export const analyzeAllItemsTool = tool({
    description:
        "Analyze ALL items from a source (Farcaster or bank transactions) without limits. Returns total count, date range, and representative sample. Use this when user asks to analyze 'all' their posts or data.",
    inputSchema: z.object({
        source: z
            .enum(["farcaster", "teller"])
            .optional()
            .describe("Filter by source: 'farcaster' for social posts, 'teller' for transactions"),
        type: z
            .enum(["cast", "transaction"])
            .optional()
            .describe("Filter by type"),
    }),
    execute: async (
        input: { source?: "farcaster" | "teller"; type?: "cast" | "transaction" }
    ): Promise<{
        totalCount: number;
        dateRange: { earliest: string | null; latest: string | null };
        sampleItems: Array<{ id: string; source: string; type: string; timestamp: string; data: Record<string, unknown> }>;
    }> => {
        const { source, type } = input;
        const itemsService = new ItemsService();

        // Get total count using efficient COUNT query
        const totalCount = await itemsService.getCount({ source, type });

        // Get a large sample for analysis (first 1000 items)
        const result = await itemsService.getItems({
            source,
            type,
            limit: 1000,
        });

        // Calculate date range
        let earliest: string | null = null;
        let latest: string | null = null;

        if (result.items.length > 0) {
            latest = result.items[0].timestamp.toISOString();
            earliest = result.items[result.items.length - 1].timestamp.toISOString();
        }

        return {
            totalCount,
            dateRange: { earliest, latest },
            sampleItems: result.items.slice(0, 100).map((item: Item) => ({
                id: item.id,
                source: item.source,
                type: item.type,
                timestamp: item.timestamp.toISOString(),
                data: item.data,
            })),
        };
    },
});

/**
 * Direct SQLite query tool - allows Claude to run custom SQL queries
 */
export const querySQLiteTool = tool({
    description: `Execute custom SQL SELECT queries against the local SQLite database. Use this for advanced queries that the other tools don't support. ${getDatabaseSchema()}`,
    inputSchema: z.object({
        query: z
            .string()
            .describe("SQL SELECT query to execute. Only SELECT queries are allowed for safety. Example: SELECT * FROM items WHERE source = 'farcaster' LIMIT 10"),
    }),
    execute: async (
        input: { query: string }
    ): Promise<{ success: boolean; data?: Record<string, unknown>[]; error?: string; rowCount?: number }> => {
        const result = executeRawQuery(input.query);
        if (result.success && result.data) {
            return {
                success: true,
                data: result.data.slice(0, 100), // Limit to 100 rows to avoid token overflow
                rowCount: result.data.length,
            };
        }
        return result;
    },
});

export const tools = {
    searchItems: searchItemsTool,
    analyzeAllItems: analyzeAllItemsTool,
    querySQLite: querySQLiteTool,
    ...obsidianTools,
    ...browserTools,
};
