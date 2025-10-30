export type TransportType = "stdio" | "http" | "https" | "sse" | "streamable-http";

export interface CursorServerConfig {
	url?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	headers?: Record<string, string>;
}

export interface CursorServer {
	id: string;
	name: string;
	description: string;
	transport: TransportType[];
	oauth: boolean;
	iconUrl: string;
	config: CursorServerConfig;
	domains?: string[];
	lastUpdated: Date;
}

