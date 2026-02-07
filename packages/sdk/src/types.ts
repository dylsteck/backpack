export interface Item {
	id: string;
	source: string;
	type: string;
	timestamp: Date;
	data: Record<string, any>;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface TimelineResult {
	items: Item[];
	nextCursor: string | null;
	count: number;
}

export interface ItemsResult {
	items: Item[];
	nextCursor: string | null;
	total: number;
	count: number;
}

export interface SearchResultItem {
	id: string;
	source: string;
	type: string;
	title?: string;
	snippet?: string;
	score: number;
	timestamp?: string;
	data?: Record<string, any>;
}

export interface SearchResult {
	query: string;
	results: SearchResultItem[];
	count: number;
}

export interface Connection {
	id: string;
	appId: string;
	appName: string;
	status: string;
	transportType: string;
	lastSyncedAt: string | null;
	createdAt: string;
}

export interface SyncResult {
	success: boolean;
	appId: string;
	newItems: number;
	error?: string;
}

export interface StatusItemCount {
	source: string;
	type: string;
	count: number;
}

export interface StatusConnection {
	id: string;
	name: string;
	status: string;
	lastSyncedAt: string | null;
}

export interface StatusApp {
	id: string;
	name: string;
	connectionType: string;
}

export interface StatusResult {
	connections: StatusConnection[];
	items: StatusItemCount[];
	apps: StatusApp[];
}

export interface TimelineOptions {
	source?: string;
	type?: string;
	limit?: number;
	cursor?: string;
}

export interface ItemsOptions {
	source?: string;
	type?: string;
	limit?: number;
	cursor?: string;
	all?: boolean;
}

export interface SearchOptions {
	limit?: number;
	dbOnly?: boolean;
}
