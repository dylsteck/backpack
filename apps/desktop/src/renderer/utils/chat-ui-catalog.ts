/**
 * Chat UI Catalog for json-render
 * Defines the components AI can use to generate mini UIs
 */

import { z } from 'zod';

// Action schema for buttons (future use)
const ActionSchema = z.object({
    name: z.string(),
    params: z.record(z.unknown()).optional(),
});

/**
 * Component definitions for the chat UI catalog
 * These define what props each component accepts
 */
export const chatUIComponentDefs = {
    // Data Display Components
    Metric: {
        props: z.object({
            label: z.string(),
            valuePath: z.string(),
            format: z.enum(['currency', 'percent', 'number', 'text']).optional(),
            trend: z.enum(['up', 'down', 'neutral']).optional(),
        }),
    },

    StatCard: {
        props: z.object({
            title: z.string(),
            valuePath: z.string(),
            subtitle: z.string().optional(),
            icon: z.string().optional(),
            color: z.enum(['blue', 'green', 'purple', 'orange', 'red']).optional(),
        }),
    },

    Table: {
        props: z.object({
            dataPath: z.string(),
            columns: z.array(z.object({
                key: z.string(),
                label: z.string(),
                format: z.enum(['text', 'date', 'number', 'currency']).optional(),
            })),
            maxRows: z.number().optional(),
        }),
    },

    List: {
        props: z.object({
            dataPath: z.string(),
            titlePath: z.string(),
            subtitlePath: z.string().optional(),
            maxItems: z.number().optional(),
        }),
    },

    Chart: {
        props: z.object({
            type: z.enum(['bar', 'line', 'pie']),
            dataPath: z.string(),
            xKey: z.string(),
            yKey: z.string(),
            title: z.string().optional(),
        }),
    },

    // Layout Components
    Card: {
        props: z.object({
            title: z.string().optional(),
            subtitle: z.string().optional(),
        }),
        hasChildren: true,
    },

    Grid: {
        props: z.object({
            columns: z.number().min(1).max(4).optional(),
            gap: z.enum(['sm', 'md', 'lg']).optional(),
        }),
        hasChildren: true,
    },

    Section: {
        props: z.object({
            title: z.string().optional(),
        }),
        hasChildren: true,
    },

    // Action Components (no actions wired for now)
    Button: {
        props: z.object({
            label: z.string(),
            variant: z.enum(['primary', 'secondary', 'ghost']).optional(),
            action: ActionSchema.optional(),
        }),
    },
};

/**
 * Get the catalog description for AI prompts
 */
export function getCatalogDescription(): string {
    return `
Available UI Components:

DATA DISPLAY:
- Metric: { label: string, valuePath: string, format?: 'currency'|'percent'|'number'|'text', trend?: 'up'|'down'|'neutral' }
- StatCard: { title: string, valuePath: string, subtitle?: string, icon?: string, color?: 'blue'|'green'|'purple'|'orange'|'red' }
- Table: { dataPath: string, columns: [{key: string, label: string, format?: 'text'|'date'|'number'|'currency'}], maxRows?: number }
- List: { dataPath: string, titlePath: string, subtitlePath?: string, maxItems?: number }
- Chart: { type: 'bar'|'line'|'pie', dataPath: string, xKey: string, yKey: string, title?: string }

LAYOUT:
- Card: { title?: string, subtitle?: string } - can contain children
- Grid: { columns?: 1-4, gap?: 'sm'|'md'|'lg' } - can contain children
- Section: { title?: string } - can contain children

ACTIONS:
- Button: { label: string, variant?: 'primary'|'secondary'|'ghost' }

UI TREE FORMAT:
{
  "root": "main",
  "elements": {
    "main": { "key": "main", "type": "Grid", "props": { "columns": 2 }, "children": ["metric1", "metric2"] },
    "metric1": { "key": "metric1", "type": "Metric", "props": { "label": "Revenue", "valuePath": "/revenue" } },
    "metric2": { "key": "metric2", "type": "Metric", "props": { "label": "Users", "valuePath": "/users" } }
  }
}
`.trim();
}

export type ChatUICatalog = typeof chatUIComponentDefs;
