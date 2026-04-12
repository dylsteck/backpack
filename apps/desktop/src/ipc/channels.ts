export const SDK_CHANNELS = {
	timeline: "sdk:timeline",
	items: "sdk:items",
	get: "sdk:get",
	search: "sdk:search",
	status: "sdk:status",
	connections: "sdk:connections",
	apps: "sdk:apps",
	dbPath: "sdk:db-path",
	setDbPath: "sdk:set-db-path",
} as const;

export const WINDOW_CHANNELS = {
	minimize: "window:minimize",
	maximize: "window:maximize",
	close: "window:close",
	setTrafficLightsVisible: "window:set-traffic-lights-visible",
} as const;

export const THEME_CHANNELS = {
	get: "theme:get",
	set: "theme:set",
} as const;
