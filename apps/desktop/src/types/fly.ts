import type { FlyAnalytics, FlySearchRow, FlyVisitRow } from "@backpack/sdk";

export type RecordVisitPayload = {
	sessionId: string;
	tabId: string;
	url: string;
	title?: string;
	faviconUrl?: string | null;
	referrerUrl?: string | null;
	transition?: string;
	visitedAt?: number;
};

export type ListVisitsArgs = {
	q?: string;
	from?: number;
	to?: number;
	limit?: number;
	offset?: number;
};

export type ListSearchesArgs = {
	q?: string;
	from?: number;
	to?: number;
	limit?: number;
};

export type AnalyticsArgs = { from?: number; to?: number };

export type WindowStatePayload = {
	tabs: Array<{ id: string; url: string; title: string }>;
	activeTabId: string;
};

export type FlyRendererApi = {
	ensureSession(): Promise<{ sessionId: string }>;
	recordVisit(payload: RecordVisitPayload): Promise<{ visitId: string }>;
	finalizeTab(tabId: string): Promise<void>;
	listVisits(args?: ListVisitsArgs): Promise<FlyVisitRow[]>;
	listSearches(args?: ListSearchesArgs): Promise<FlySearchRow[]>;
	analytics(args?: AnalyticsArgs): Promise<FlyAnalytics>;
	deleteAllHistory(): Promise<void>;
	getWindowState(): Promise<WindowStatePayload | null>;
	saveWindowState(state: WindowStatePayload): Promise<void>;
};
