/**
 * JSON Render Mount
 * React island for rendering json-render UI blocks in vanilla TS app
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DataProvider, Renderer } from '@json-render/react';
import type { UITree } from '@json-render/core';
import { chatUIRegistry } from './chat-ui-components';

interface MountedRoot {
    root: Root;
    container: HTMLElement;
}

// Track mounted roots for cleanup
const mountedRoots = new Map<string, MountedRoot>();

/**
 * Render a json-render tree into a DOM element
 */
export function renderJsonUI(
    containerId: string,
    tree: UITree,
    data: Record<string, unknown> = {}
): void {
    // Get or create container
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`[JsonRenderMount] Container ${containerId} not found`);
        return;
    }

    // Cleanup existing root if any
    const existing = mountedRoots.get(containerId);
    if (existing) {
        existing.root.unmount();
        mountedRoots.delete(containerId);
    }

    // Create new root
    const root = createRoot(container);
    mountedRoots.set(containerId, { root, container });

    // Render
    root.render(
        <DataProvider initialData={data}>
            <Renderer tree={tree} registry={chatUIRegistry} />
        </DataProvider>
    );
}

/**
 * Unmount a json-render tree from a container
 */
export function unmountJsonUI(containerId: string): void {
    const mounted = mountedRoots.get(containerId);
    if (mounted) {
        mounted.root.unmount();
        mountedRoots.delete(containerId);
    }
}

/**
 * Cleanup all mounted roots
 */
export function cleanupAllJsonUI(): void {
    for (const [id, mounted] of mountedRoots) {
        mounted.root.unmount();
        mountedRoots.delete(id);
    }
}

/**
 * Parse a JSON string and render it
 */
export function renderJsonUIFromString(
    containerId: string,
    jsonString: string,
    data: Record<string, unknown> = {}
): boolean {
    try {
        const tree = JSON.parse(jsonString) as UITree;
        renderJsonUI(containerId, tree, data);
        return true;
    } catch (error) {
        console.error('[JsonRenderMount] Failed to parse JSON:', error);
        return false;
    }
}

/**
 * Check if a string contains a valid json-render block
 */
export function containsJsonRenderBlock(content: string): boolean {
    return content.includes('```json-ui') || content.includes('```jsonui');
}

/**
 * Extract json-render blocks from content
 */
export function extractJsonRenderBlocks(content: string): Array<{ json: string; startIndex: number; endIndex: number }> {
    const blocks: Array<{ json: string; startIndex: number; endIndex: number }> = [];

    // Match ```json-ui or ```jsonui blocks
    const regex = /```(?:json-ui|jsonui)\s*([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        blocks.push({
            json: match[1].trim(),
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }

    return blocks;
}

/**
 * Build a UITree from a simple element structure
 * This helper makes it easier for AI to generate valid trees
 */
export function buildUITree(elements: Array<{
    key: string;
    type: string;
    props: Record<string, unknown>;
    children?: string[];
}>): UITree {
    if (elements.length === 0) {
        return { root: '', elements: {} };
    }

    const elementsMap: Record<string, { key: string; type: string; props: Record<string, unknown>; children?: string[] }> = {};
    for (const el of elements) {
        elementsMap[el.key] = el;
    }

    return {
        root: elements[0].key,
        elements: elementsMap,
    };
}
