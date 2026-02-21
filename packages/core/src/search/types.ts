/**
 * Search types
 */

import type { TimelineItem } from "../types/index.js";
import type { SourceType } from "../config/schema.js";

export interface SearchFilters {
  sources?: SourceType[];
  startDate?: Date;
  endDate?: Date;
  hasEmbeddings?: boolean;
}

export interface SearchOptions {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  useSemantic?: boolean;
  useFullText?: boolean;
}

export interface SearchResult {
  item: TimelineItem;
  score: number;
  matchType: "semantic" | "fulltext" | "both";
  highlights?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  durationMs: number;
}
