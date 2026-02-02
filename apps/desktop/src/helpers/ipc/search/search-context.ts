/**
 * Search Context Bridge
 * Exposes search APIs to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';
import { SEARCH_CHANNELS } from './search-channels';

export interface SearchResult {
	id: string;
	source: string;
	type: string;
	title?: string;
	snippet?: string;
	score: number;
	timestamp?: string;
	data?: unknown;
}

export interface SearchResponse {
	query: string;
	results: SearchResult[];
	count: number;
	error?: string;
}

export interface EmbedSyncResponse {
	success: boolean;
	exportedCount?: number;
	error?: string;
	timestamp?: number;
}

export function exposeSearchContext() {
	contextBridge.exposeInMainWorld('searchApi', {
		/**
		 * Search across all Cortex data
		 */
		search: (query: string, limit?: number): Promise<SearchResponse> => {
			return ipcRenderer.invoke(SEARCH_CHANNELS.SEARCH, query, limit);
		},

		/**
		 * Trigger embedding sync for search index
		 */
		embedSync: (force?: boolean): Promise<EmbedSyncResponse> => {
			return ipcRenderer.invoke(SEARCH_CHANNELS.EMBED_SYNC, force);
		},
	});
}
