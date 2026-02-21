export interface ParamSpec {
	type: string;
	optional?: boolean;
	description?: string;
}

export interface MethodSpec {
	description: string;
	params: Record<string, ParamSpec>;
	returns?: string;
}

export interface ServiceSpec {
	[method: string]: MethodSpec;
}

export interface CortexSpec {
	timeline: {
		description: string;
		params: {
			limit?: ParamSpec;
			source?: ParamSpec;
			type?: ParamSpec;
			cursor?: ParamSpec;
		};
		returns: string;
	};
	items: {
		description: string;
		params: {
			limit?: ParamSpec;
			source?: ParamSpec;
			type?: ParamSpec;
			cursor?: ParamSpec;
			all?: ParamSpec;
		};
		returns: string;
	};
	get: {
		description: string;
		params: {
			id: ParamSpec;
		};
		returns: string;
	};
	search: {
		description: string;
		params: {
			query: ParamSpec;
			limit?: ParamSpec;
			dbOnly?: ParamSpec;
		};
		returns: string;
	};
	connections: {
		description: string;
		params: Record<string, ParamSpec>;
		returns: string;
	};
	sync: {
		description: string;
		params: {
			appId?: ParamSpec;
		};
		returns: string;
	};
	status: {
		description: string;
		params: Record<string, ParamSpec>;
		returns: string;
	};
	obsidian: ServiceSpec;
	browser: ServiceSpec;
}

export const cortexSpec: CortexSpec = {
	timeline: {
		description: "Get timeline items from all connected sources",
		params: {
			limit: { type: "number", optional: true, description: "Max items to return" },
			source: { type: "string", optional: true, description: "Filter by source (e.g., 'farcaster', 'teller')" },
			type: { type: "string", optional: true, description: "Filter by type" },
			cursor: { type: "string", optional: true, description: "Pagination cursor" },
		},
		returns: "{ items: Item[], nextCursor: string | null, count: number }",
	},
	items: {
		description: "Get items with pagination support",
		params: {
			limit: { type: "number", optional: true, description: "Items per page" },
			source: { type: "string", optional: true, description: "Filter by source" },
			type: { type: "string", optional: true, description: "Filter by type" },
			cursor: { type: "string", optional: true, description: "Pagination cursor" },
			all: { type: "boolean", optional: true, description: "Fetch all items" },
		},
		returns: "{ items: Item[], nextCursor: string | null, total: number, count: number }",
	},
	get: {
		description: "Get a single item by ID",
		params: {
			id: { type: "string", description: "The item ID" },
		},
		returns: "Item | null",
	},
	search: {
		description: "Search across timeline items using hybrid search",
		params: {
			query: { type: "string", description: "Search query" },
			limit: { type: "number", optional: true, description: "Max results" },
			dbOnly: { type: "boolean", optional: true, description: "Skip vector search" },
		},
		returns: "{ query: string, results: SearchResultItem[], count: number }",
	},
	connections: {
		description: "List all connected apps and their status",
		params: {},
		returns: "Connection[]",
	},
	sync: {
		description: "Sync data from connected apps",
		params: {
			appId: { type: "string", optional: true, description: "Specific app to sync" },
		},
		returns: "SyncResult[]",
	},
	status: {
		description: "Get overall system status",
		params: {},
		returns: "StatusResult",
	},
	obsidian: {
		listNotes: {
			description: "List all notes in the connected Obsidian vault",
			params: {
				limit: { type: "number", optional: true, description: "Max notes to return" },
				search: { type: "string", optional: true, description: "Search query" },
				folder: { type: "string", optional: true, description: "Filter by folder" },
			},
			returns: "{ success: boolean, notes: ObsidianNote[], totalNotes: number, error?: string }",
		},
		readNote: {
			description: "Read the full content of a specific note",
			params: {
				notePath: { type: "string", description: "Path or title of the note" },
			},
			returns: "{ success: boolean, note?: ObsidianNote, error?: string, suggestions?: string[] }",
		},
		createNote: {
			description: "Create a new note in the vault",
			params: {
				title: { type: "string", description: "Note title" },
				content: { type: "string", description: "Note content (markdown)" },
				tags: { type: "string[]", optional: true, description: "Array of tags" },
				folder: { type: "string", optional: true, description: "Target folder" },
			},
			returns: "{ success: boolean, message?: string, notePath?: string, error?: string }",
		},
		updateNote: {
			description: "Update an existing note",
			params: {
				notePath: { type: "string", description: "Path or title of the note" },
				content: { type: "string", description: "Content to add/replace" },
				mode: { type: "'append' | 'prepend' | 'replace'", description: "Update mode" },
			},
			returns: "{ success: boolean, message?: string, notePath?: string, error?: string }",
		},
		addBacklink: {
			description: "Add a wikilink backlink to a note",
			params: {
				notePath: { type: "string", description: "Path or title of the note" },
				targetNote: { type: "string", description: "Note to link to" },
				context: { type: "string", optional: true, description: "Context around the link" },
			},
			returns: "{ success: boolean, message?: string, notePath?: string, error?: string }",
		},
		search: {
			description: "Search notes in the vault",
			params: {
				query: { type: "string", description: "Search query" },
				searchIn: { type: "'all' | 'titles' | 'content' | 'tags'", optional: true, description: "Where to search" },
				limit: { type: "number", optional: true, description: "Max results" },
				folder: { type: "string", optional: true, description: "Filter by folder" },
			},
			returns: "{ success: boolean, results: ObsidianNote[], totalFound: number, error?: string }",
		},
	},
	browser: {
		navigate: {
			description: "Navigate to a URL in the browser",
			params: {
				url: { type: "string", description: "URL to navigate to" },
				type: { type: "'url' | 'back' | 'forward' | 'reload'", optional: true, description: "Navigation type" },
			},
			returns: "NavigateResult",
		},
		click: {
			description: "Click an element by UID",
			params: {
				uid: { type: "string", description: "Element UID from snapshot" },
				dblClick: { type: "boolean", optional: true, description: "Double click" },
			},
			returns: "ClickResult",
		},
		fill: {
			description: "Fill a form input",
			params: {
				uid: { type: "string", description: "Input element UID" },
				value: { type: "string", description: "Value to fill" },
			},
			returns: "FillResult",
		},
		screenshot: {
			description: "Take a screenshot of the current page",
			params: {},
			returns: "ScreenshotResult",
		},
		snapshot: {
			description: "Get a DOM snapshot",
			params: {
				verbose: { type: "boolean", optional: true, description: "Include details" },
			},
			returns: "SnapshotResult",
		},
		network: {
			description: "List network requests",
			params: {},
			returns: "NetworkResult",
		},
		evaluate: {
			description: "Execute JavaScript in the browser",
			params: {
				script: { type: "string", description: "JS function as string" },
				args: { type: "any[]", optional: true, description: "Arguments" },
			},
			returns: "EvaluateResult",
		},
		wait: {
			description: "Wait for text to appear",
			params: {
				text: { type: "string", description: "Text to wait for" },
				timeout: { type: "number", optional: true, description: "Timeout ms" },
			},
			returns: "WaitResult",
		},
		listPages: {
			description: "List open browser tabs",
			params: {},
			returns: "ListPagesResult",
		},
		selectPage: {
			description: "Switch to a specific tab",
			params: {
				pageId: { type: "number", description: "Page ID from listPages" },
			},
			returns: "SelectPageResult",
		},
	},
};
