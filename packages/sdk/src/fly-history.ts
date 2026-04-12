import {
	getDatabase,
	flyBrowseSessions,
	flyVisits,
	flySearches,
	flyWindowState,
} from "@backpack/db";
import { eq, desc, and, sql, gte, lte, or, like, isNull } from "drizzle-orm";

const WINDOW_ROW_ID = "default";
const DEDUPE_MS = 3000;

export type FlyTabSnapshot = { id: string; url: string; title: string };

export type FlyVisitRow = {
	id: string;
	sessionId: string | null;
	tabId: string;
	url: string;
	title: string | null;
	faviconUrl: string | null;
	domain: string;
	visitedAt: number;
	referrerUrl: string | null;
	transition: string;
	precedingVisitId: string | null;
	durationMs: number | null;
};

export type FlySearchRow = {
	id: string;
	query: string;
	searchedAt: number;
	engine: string | null;
	sourceVisitId: string | null;
};

export type FlyAnalytics = {
	visitsByDay: { date: string; count: number }[];
	topDomains: { domain: string; count: number }[];
	transitions: { transition: string; count: number }[];
};

function extractSearch(urlStr: string): { query: string; engine: string } | null {
	try {
		const u = new URL(urlStr);
		if (u.protocol !== "http:" && u.protocol !== "https:") return null;
		const host = u.hostname.toLowerCase();
		let engine: string | null = null;
		if (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) engine = "duckduckgo";
		else if (host === "www.bing.com" || host === "bing.com") engine = "bing";
		else if (host.includes("google.")) engine = "google";
		else if (host.includes("yahoo.")) engine = "yahoo";
		if (!engine) return null;
		const q = u.searchParams.get("q") ?? u.searchParams.get("p");
		if (!q?.trim()) return null;
		return { query: decodeURIComponent(q.replace(/\+/g, " ")).trim(), engine };
	} catch {
		return null;
	}
}

function normalizeDomain(url: string): string {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return "";
	}
}

export class FlyHistoryService {
	private sessionId: string | null = null;

	ensureSession(): string {
		const db = getDatabase();
		if (this.sessionId) return this.sessionId;
		const id = crypto.randomUUID();
		const now = Date.now();
		db.insert(flyBrowseSessions).values({ id, startedAt: now }).run();
		this.sessionId = id;
		return id;
	}

	recordVisit(input: {
		sessionId: string;
		tabId: string;
		url: string;
		title?: string;
		faviconUrl?: string | null;
		referrerUrl?: string | null;
		transition?: string;
		visitedAt?: number;
	}): { visitId: string } {
		const db = getDatabase();
		const visitedAt = input.visitedAt ?? Date.now();
		const domain = normalizeDomain(input.url);

		return db.transaction((tx) => {
			const prevRows = tx
				.select()
				.from(flyVisits)
				.where(eq(flyVisits.tabId, input.tabId))
				.orderBy(desc(flyVisits.visitedAt))
				.limit(1)
				.all();
			const prev = prevRows[0];

			if (prev && prev.url === input.url && visitedAt - prev.visitedAt < DEDUPE_MS) {
				return { visitId: prev.id };
			}

			if (prev && prev.durationMs == null) {
				const dur = Math.max(0, visitedAt - prev.visitedAt);
				tx.update(flyVisits).set({ durationMs: dur }).where(eq(flyVisits.id, prev.id)).run();
			}

			const visitId = crypto.randomUUID();
			tx.insert(flyVisits)
				.values({
					id: visitId,
					sessionId: input.sessionId,
					tabId: input.tabId,
					url: input.url,
					title: input.title ?? null,
					faviconUrl: input.faviconUrl ?? null,
					domain,
					visitedAt,
					referrerUrl: input.referrerUrl ?? null,
					transition: input.transition ?? "unknown",
					precedingVisitId: prev?.id ?? null,
				})
				.run();

			const search = extractSearch(input.url);
			if (search) {
				tx.insert(flySearches)
					.values({
						id: crypto.randomUUID(),
						query: search.query,
						searchedAt: visitedAt,
						engine: search.engine,
						sourceVisitId: visitId,
					})
					.run();
			}

			return { visitId };
		});
	}

	finalizeTab(tabId: string, closedAt = Date.now()): void {
		const db = getDatabase();
		db.transaction((tx) => {
			const rows = tx
				.select()
				.from(flyVisits)
				.where(and(eq(flyVisits.tabId, tabId), isNull(flyVisits.durationMs)))
				.orderBy(desc(flyVisits.visitedAt))
				.limit(1)
				.all();
			const row = rows[0];
			if (!row) return;
			const dur = Math.max(0, closedAt - row.visitedAt);
			tx.update(flyVisits).set({ durationMs: dur }).where(eq(flyVisits.id, row.id)).run();
		});
	}

	async listVisits(args: {
		q?: string;
		from?: number;
		to?: number;
		limit?: number;
		offset?: number;
	}): Promise<FlyVisitRow[]> {
		const db = getDatabase();
		const limit = Math.min(args.limit ?? 200, 500);
		const offset = args.offset ?? 0;
		const conditions = [];
		if (args.from != null) conditions.push(gte(flyVisits.visitedAt, args.from));
		if (args.to != null) conditions.push(lte(flyVisits.visitedAt, args.to));
		const q = args.q?.trim();
		if (q) {
			const pattern = `%${q.replace(/%/g, "\\%")}%`;
			conditions.push(
				or(
					like(flyVisits.url, pattern),
					like(flyVisits.title, pattern),
					like(flyVisits.domain, pattern),
				),
			);
		}

		let query = db.select().from(flyVisits);
		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as typeof query;
		}

		const rows = await query
			.orderBy(desc(flyVisits.visitedAt))
			.limit(limit)
			.offset(offset);

		return rows.map((r) => ({
			id: r.id,
			sessionId: r.sessionId,
			tabId: r.tabId,
			url: r.url,
			title: r.title,
			faviconUrl: r.faviconUrl,
			domain: r.domain,
			visitedAt: r.visitedAt,
			referrerUrl: r.referrerUrl,
			transition: r.transition,
			precedingVisitId: r.precedingVisitId,
			durationMs: r.durationMs,
		}));
	}

	async listSearches(args: {
		q?: string;
		from?: number;
		to?: number;
		limit?: number;
	}): Promise<FlySearchRow[]> {
		const db = getDatabase();
		const limit = Math.min(args.limit ?? 200, 500);
		const conditions = [];
		if (args.from != null) conditions.push(gte(flySearches.searchedAt, args.from));
		if (args.to != null) conditions.push(lte(flySearches.searchedAt, args.to));
		const q = args.q?.trim();
		if (q) {
			const pattern = `%${q.replace(/%/g, "\\%")}%`;
			conditions.push(like(flySearches.query, pattern));
		}

		let query = db.select().from(flySearches);
		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as typeof query;
		}

		const rows = await query.orderBy(desc(flySearches.searchedAt)).limit(limit);

		return rows.map((r) => ({
			id: r.id,
			query: r.query,
			searchedAt: r.searchedAt,
			engine: r.engine,
			sourceVisitId: r.sourceVisitId,
		}));
	}

	async getAnalytics(args: { from?: number; to?: number }): Promise<FlyAnalytics> {
		const db = getDatabase();
		const from = args.from ?? 0;
		const to = args.to ?? Date.now();

		const visitsByDayRows = await db
			.select({
				date: sql<string>`date(${flyVisits.visitedAt} / 1000, 'unixepoch')`,
				count: sql<number>`count(*)`,
			})
			.from(flyVisits)
			.where(and(gte(flyVisits.visitedAt, from), lte(flyVisits.visitedAt, to)))
			.groupBy(sql`date(${flyVisits.visitedAt} / 1000, 'unixepoch')`)
			.orderBy(sql`date(${flyVisits.visitedAt} / 1000, 'unixepoch')`);

		const topDomainsRows = await db
			.select({
				domain: flyVisits.domain,
				count: sql<number>`count(*)`,
			})
			.from(flyVisits)
			.where(and(gte(flyVisits.visitedAt, from), lte(flyVisits.visitedAt, to)))
			.groupBy(flyVisits.domain)
			.orderBy(desc(sql`count(*)`))
			.limit(15);

		const transitionsRows = await db
			.select({
				transition: flyVisits.transition,
				count: sql<number>`count(*)`,
			})
			.from(flyVisits)
			.where(and(gte(flyVisits.visitedAt, from), lte(flyVisits.visitedAt, to)))
			.groupBy(flyVisits.transition)
			.orderBy(desc(sql`count(*)`));

		return {
			visitsByDay: visitsByDayRows.map((r) => ({ date: r.date, count: Number(r.count) })),
			topDomains: topDomainsRows.map((r) => ({ domain: r.domain, count: Number(r.count) })),
			transitions: transitionsRows.map((r) => ({
				transition: r.transition,
				count: Number(r.count),
			})),
		};
	}

	async deleteAllHistory(): Promise<void> {
		const db = getDatabase();
		await db.delete(flySearches);
		await db.delete(flyVisits);
		await db.delete(flyBrowseSessions);
	}

	async getWindowState(): Promise<{ tabs: FlyTabSnapshot[]; activeTabId: string } | null> {
		const db = getDatabase();
		const rows = await db
			.select()
			.from(flyWindowState)
			.where(eq(flyWindowState.id, WINDOW_ROW_ID))
			.limit(1);
		const row = rows[0];
		if (!row) return null;
		try {
			const parsed = JSON.parse(row.tabsJson) as {
				tabs?: FlyTabSnapshot[];
				activeTabId?: string;
			};
			const tabs = parsed.tabs?.filter((t) => t?.id && typeof t.url === "string") ?? [];
			const firstTab = tabs[0];
			if (!firstTab) return null;
			let activeTabId = parsed.activeTabId ?? firstTab.id;
			if (!tabs.some((t) => t.id === activeTabId)) activeTabId = firstTab.id;
			return { tabs, activeTabId };
		} catch {
			return null;
		}
	}

	async saveWindowState(state: { tabs: FlyTabSnapshot[]; activeTabId: string }): Promise<void> {
		const db = getDatabase();
		const json = JSON.stringify(state);
		const now = Date.now();
		await db
			.insert(flyWindowState)
			.values({ id: WINDOW_ROW_ID, tabsJson: json, updatedAt: now })
			.onConflictDoUpdate({
				target: flyWindowState.id,
				set: { tabsJson: json, updatedAt: now },
			});
	}
}
