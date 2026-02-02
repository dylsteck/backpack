/**
 * Interactive search TUI using OpenTUI
 * Provides a fuzzy-finder style interface for search results
 */

import type { CliRenderer } from "@opentui/core";

interface SearchResult {
	id: string;
	source: string;
	type: string;
	title?: string;
	snippet?: string;
	score: number;
}

interface SearchTUIOptions {
	query: string;
	results: SearchResult[];
	onSelect?: (result: SearchResult) => void;
	onExit?: () => void;
}

/**
 * Run interactive search TUI
 * Returns the selected result or null if cancelled
 */
export async function runSearchTUI(options: SearchTUIOptions): Promise<SearchResult | null> {
	try {
		// Dynamic import to make OpenTUI optional
		const { 
			createCliRenderer, 
			SelectRenderable, 
			SelectRenderableEvents,
			BoxRenderable,
			TextRenderable,
			t,
			fg,
			bold,
		} = await import("@opentui/core");

		return new Promise(async (resolve) => {
			const renderer = await createCliRenderer({
				exitOnCtrlC: true,
			});

			renderer.setBackgroundColor("#0f172a");

			let selectedResult: SearchResult | null = null;

			// Main container
			const container = new BoxRenderable(renderer, {
				id: "search-container",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				padding: 1,
			});
			renderer.root.add(container);

			// Header
			const header = new TextRenderable(renderer, {
				id: "search-header",
				content: t`${bold(fg("#60a5fa")(`🔍 Search: "${options.query}"`))}`,
				height: 2,
				flexShrink: 0,
			});
			container.add(header);

			// Results info
			const info = new TextRenderable(renderer, {
				id: "search-info",
				content: t`${fg("#94a3b8")(`${options.results.length} results found`)}`,
				height: 1,
				flexShrink: 0,
			});
			container.add(info);

			// Results list
			const selectOptions = options.results.map((result) => ({
				name: `[${result.source}] ${result.title || result.id}`,
				description: result.snippet ? result.snippet.slice(0, 80) : undefined,
				value: result,
			}));

			const select = new SelectRenderable(renderer, {
				id: "search-results",
				options: selectOptions,
				flexGrow: 1,
				backgroundColor: "#1e293b",
				focusedBackgroundColor: "#1e293b",
				selectedBackgroundColor: "#3b82f6",
				textColor: "#e2e8f0",
				selectedTextColor: "#ffffff",
				descriptionColor: "#64748b",
				selectedDescriptionColor: "#94a3b8",
				showDescription: true,
				showScrollIndicator: true,
				wrapSelection: false,
			});
			container.add(select);

			// Footer
			const footer = new TextRenderable(renderer, {
				id: "search-footer",
				content: t`${fg("#64748b")("↑↓ navigate | Enter select | Esc exit")}`,
				height: 1,
				flexShrink: 0,
				marginTop: 1,
			});
			container.add(footer);

			// Handle selection
			select.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: { value: SearchResult }) => {
				selectedResult = option.value;
				cleanup();
			});

			// Handle keyboard
			const cleanup = () => {
				renderer.destroy();
				resolve(selectedResult);
			};

			renderer.keyInput.on("keypress", (key: { name: string }) => {
				if (key.name === "escape" || key.name === "q") {
					cleanup();
				}
			});

			select.focus();
			renderer.start();
		});
	} catch (error) {
		// OpenTUI not available
		console.error("Interactive mode requires OpenTUI. Install with: bun add @opentui/core");
		console.error("Note: OpenTUI requires Zig to be installed on your system.");
		return null;
	}
}
