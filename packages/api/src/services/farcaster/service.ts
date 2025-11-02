import type {
	EmbeddedUrlMetadata,
	FrameCatalogResponse,
	FrameSearchResponse,
	CastSearchResponse,
	CastResponse,
	ChannelsFeedResponse,
	TrendingCastsResponse,
	UserByLocationResponse,
	UserCastsResponse,
} from "./types";

export class FarcasterService {
	private readonly apiKey: string;
	private readonly baseUrl = "https://api.neynar.com/v2";

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	private async fetcher<T>(url: string, options?: RequestInit): Promise<T> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json",
			"x-api-key": this.apiKey,
		};

		const response = await fetch(`${this.baseUrl}/${url}`, { headers, ...options });

		if (!response.ok) {
			const errorText = await response.text();
			console.error(errorText);
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return response.json() as Promise<T>;
	}

	async getEmbeddedUrlMetadata({ url }: { url: string }): Promise<EmbeddedUrlMetadata> {
		const endpoint = `/farcaster/cast/embed/crawl?url=${encodeURIComponent(url)}`;
		return this.fetcher<EmbeddedUrlMetadata>(endpoint);
	}

	async getFrameCatalog({
		limit = 100,
		cursor,
		time_window = "7d",
		categories,
	}: {
		limit?: number;
		cursor?: string;
		time_window?: "1h" | "6h" | "12h" | "24h" | "7d";
		categories?: string[];
	} = {}): Promise<FrameCatalogResponse> {
		let endpoint = `/farcaster/frame/catalog?limit=${limit}&time_window=${time_window}`;
		if (cursor) endpoint += `&cursor=${cursor}`;
		if (categories && categories.length > 0) endpoint += `&categories=${categories.join(",")}`;
		return this.fetcher<FrameCatalogResponse>(endpoint);
	}

	async searchFrames({
		q,
		limit = 25,
		cursor,
	}: {
		q: string;
		limit?: number;
		cursor?: string;
	}): Promise<FrameSearchResponse> {
		let endpoint = `/farcaster/frame/search?q=${encodeURIComponent(q)}&limit=${limit}`;
		if (cursor) endpoint += `&cursor=${cursor}`;
		return this.fetcher<FrameSearchResponse>(endpoint);
	}

	async castSearch({
		q,
		author_fid,
		viewer_fid,
		parent_url,
		channel_id,
		priority_mode = false,
		limit = 25,
		cursor,
	}: {
		q: string;
		author_fid?: number;
		viewer_fid?: number;
		parent_url?: string;
		channel_id?: string;
		priority_mode?: boolean;
		limit?: number;
		cursor?: string;
	}): Promise<CastSearchResponse> {
		let endpoint = `/farcaster/cast/search?q=${encodeURIComponent(q)}&limit=${limit}&priority_mode=${priority_mode}`;
		if (author_fid) endpoint += `&author_fid=${author_fid}`;
		if (viewer_fid) endpoint += `&viewer_fid=${viewer_fid}`;
		if (parent_url) endpoint += `&parent_url=${encodeURIComponent(parent_url)}`;
		if (channel_id) endpoint += `&channel_id=${channel_id}`;
		if (cursor) endpoint += `&cursor=${cursor}`;
		return this.fetcher<CastSearchResponse>(endpoint);
	}

	async getCast({
		identifier,
		type,
		viewer_fid,
	}: {
		identifier: string;
		type: "url" | "hash";
		viewer_fid?: number;
	}): Promise<CastResponse> {
		let endpoint = `/farcaster/cast?identifier=${encodeURIComponent(identifier)}&type=${type}`;
		if (viewer_fid) endpoint += `&viewer_fid=${viewer_fid}`;
		return this.fetcher<CastResponse>(endpoint);
	}

	async getChannelsFeed({
		channel_ids,
		with_recasts = true,
		viewer_fid,
		with_replies = false,
		members_only = true,
		fids,
		limit = 25,
		cursor,
	}: {
		channel_ids: string;
		with_recasts?: boolean;
		viewer_fid?: number;
		with_replies?: boolean;
		members_only?: boolean;
		fids?: string;
		limit?: number;
		cursor?: string;
	}): Promise<ChannelsFeedResponse> {
		let endpoint = `/farcaster/feed/channels?channel_ids=${encodeURIComponent(channel_ids)}&with_recasts=${with_recasts}&with_replies=${with_replies}&members_only=${members_only}&limit=${limit}`;
		if (viewer_fid) endpoint += `&viewer_fid=${viewer_fid}`;
		if (fids) endpoint += `&fids=${encodeURIComponent(fids)}`;
		if (cursor) endpoint += `&cursor=${cursor}`;
		return this.fetcher<ChannelsFeedResponse>(endpoint);
	}

	async getTrendingCasts({
		limit = 10,
		cursor,
		viewer_fid,
		time_window = "24h",
		channel_id,
		provider,
	}: {
		limit?: number;
		cursor?: string;
		viewer_fid?: number;
		time_window?: string;
		channel_id?: string;
		provider?: string;
	} = {}): Promise<TrendingCastsResponse> {
		let endpoint = `/farcaster/feed/trending?limit=${limit}&time_window=${time_window}`;
		if (cursor) endpoint += `&cursor=${cursor}`;
		if (viewer_fid) endpoint += `&viewer_fid=${viewer_fid}`;
		if (channel_id) endpoint += `&channel_id=${channel_id}`;
		if (provider) endpoint += `&provider=${provider}`;
		return this.fetcher<TrendingCastsResponse>(endpoint);
	}

	async getUserByLocation({
		latitude,
		longitude,
		viewer_fid,
		limit = 25,
		cursor,
	}: {
		latitude: number;
		longitude: number;
		viewer_fid?: number;
		limit?: number;
		cursor?: string;
	}): Promise<UserByLocationResponse> {
		let endpoint = `/farcaster/user/by_location?latitude=${latitude}&longitude=${longitude}&limit=${limit}`;
		if (viewer_fid) endpoint += `&viewer_fid=${viewer_fid}`;
		if (cursor) endpoint += `&cursor=${cursor}`;
		return this.fetcher<UserByLocationResponse>(endpoint);
	}

	async getUserCasts({
		fid,
		viewer_fid,
		limit = 25,
		cursor,
		include_replies = true,
		parent_url,
		channel_id,
	}: {
		fid: number;
		viewer_fid?: number;
		limit?: number;
		cursor?: string;
		include_replies?: boolean;
		parent_url?: string;
		channel_id?: string;
	}): Promise<UserCastsResponse> {
		let endpoint = `/farcaster/feed/user/casts?fid=${fid}&limit=${limit}&include_replies=${include_replies}`;
		if (viewer_fid) endpoint += `&viewer_fid=${viewer_fid}`;
		if (parent_url) endpoint += `&parent_url=${encodeURIComponent(parent_url)}`;
		if (channel_id) endpoint += `&channel_id=${channel_id}`;
		if (cursor) endpoint += `&cursor=${cursor}`;
		return this.fetcher<UserCastsResponse>(endpoint);
	}

	async getTrendingVideos({
		viewer_fid,
		limit = 25,
		cursor,
	}: {
		viewer_fid?: number;
		limit?: number;
		cursor?: string;
	}): Promise<CastSearchResponse> {
		let endpoint = `/farcaster/cast/search?q=${encodeURIComponent("stream.warpcast.com")}&priority_mode=true&limit=${limit}`;
		if (viewer_fid) endpoint += `&viewer_fid=${viewer_fid}`;
		if (cursor) endpoint += `&cursor=${cursor}`;
		return this.fetcher<CastSearchResponse>(endpoint);
	}

	async getUserVideos({
		author_fid,
		viewer_fid,
		limit = 25,
		cursor,
	}: {
		author_fid: number;
		viewer_fid?: number;
		limit?: number;
		cursor?: string;
	}): Promise<CastSearchResponse> {
		let endpoint = `/farcaster/cast/search?q=${encodeURIComponent("stream.warpcast.com")}&priority_mode=true&limit=${limit}&author_fid=${author_fid}`;
		if (viewer_fid) endpoint += `&viewer_fid=${viewer_fid}`;
		if (cursor) endpoint += `&cursor=${cursor}`;
		return this.fetcher<CastSearchResponse>(endpoint);
	}
}

