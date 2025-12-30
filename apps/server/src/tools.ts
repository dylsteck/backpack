/**
 * AI Tools for Chat
 * Item search tool for querying saved items
 */

import { tool } from "ai";
import { z } from "zod";
import { ItemsService } from "@cortex/api/services/items/service";

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
        .default(5)
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
    ): Promise<{ items: Array<{ id: string; source: string; type: string; timestamp: string; data: Record<string, unknown> }>; totalFound: number }> => {
        const { query, source, type, limit } = input;
        const itemsService = new ItemsService();
        const result = await itemsService.getItems({
            source,
            type,
            limit: limit || 5,
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

export const tools = {
    searchItems: searchItemsTool,
};
