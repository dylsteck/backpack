const BRIDGE_PORT = process.env.BROWSER_BRIDGE_PORT || "3001";
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}/browser-tool`;

export interface NavigateResult {
	success: boolean;
	url?: string;
	action?: string;
	message?: string;
	result?: any;
	error?: string;
}

export interface ClickResult {
	success: boolean;
	message?: string;
	error?: string;
}

export interface FillResult {
	success: boolean;
	message?: string;
	error?: string;
}

export interface ScreenshotResult {
	success: boolean;
	imageDataUrl?: string;
	content?: any[];
	screenshot?: string;
	error?: string;
}

export interface SnapshotResult {
	success: boolean;
	tree?: any;
	verbose?: boolean;
	error?: string;
}

export interface NetworkResult {
	success: boolean;
	requests?: any[];
	error?: string;
}

export interface EvaluateResult {
	success: boolean;
	result?: any;
	error?: string;
}

export interface WaitResult {
	success: boolean;
	message?: string;
	error?: string;
}

export interface ListPagesResult {
	success: boolean;
	pages?: Array<{
		id: number;
		title: string;
		url: string;
	}>;
	error?: string;
}

export interface SelectPageResult {
	success: boolean;
	message?: string;
	error?: string;
}

async function callBrowserTool(toolName: string, args: any): Promise<any> {
	try {
		const response = await fetch(BRIDGE_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ toolName, args }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Bridge returned ${response.status}: ${errorText}`);
		}

		const data = await response.json();
		if (!data.success) {
			throw new Error(data.error || "Tool call failed");
		}

		return data.result;
	} catch (error: any) {
		if (error.code === "ECONNREFUSED" || error.message?.includes("ECONNREFUSED")) {
			throw new Error(
				"Browser bridge not available. Make sure the browser tab is open."
			);
		}
		throw new Error(
			`Failed to call browser tool ${toolName}: ${error.message || error}`
		);
	}
}

export class BrowserService {
	async navigate(
		url: string,
		type: "url" | "back" | "forward" | "reload" = "url"
	): Promise<NavigateResult> {
		try {
			let normalizedUrl = url.trim();
			if (!normalizedUrl.match(/^https?:\/\//i)) {
				normalizedUrl = `https://${normalizedUrl}`;
			}

			if (type === "url") {
				const result = await callBrowserTool("navigate_page", {
					type: "url",
					url: normalizedUrl,
				});
				return {
					success: true,
					url: normalizedUrl,
					message: `Navigated to ${normalizedUrl}`,
					result,
				};
			} else {
				const result = await callBrowserTool("navigate_page", { type });
				return {
					success: true,
					action: type,
					result,
				};
			}
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Navigation failed",
			};
		}
	}

	async click(uid: string, dblClick: boolean = false): Promise<ClickResult> {
		try {
			const result = await callBrowserTool("click", { uid, dblClick });
			return {
				success: true,
				message: `Clicked element ${uid}`,
				...result,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Click failed",
			};
		}
	}

	async fill(uid: string, value: string): Promise<FillResult> {
		try {
			const result = await callBrowserTool("fill", { uid, value });
			return {
				success: true,
				message: `Filled element ${uid}`,
				...result,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Fill failed",
			};
		}
	}

	async screenshot(): Promise<ScreenshotResult> {
		try {
			const result = await callBrowserTool("take_screenshot", {});
			try {
				if (result?.content && Array.isArray(result.content)) {
					const imageBlock = result.content.find(
						(block: any) => block?.type === "image" && block?.data
					);
					if (imageBlock?.data) {
						return {
							success: true,
							imageDataUrl: `data:image/png;base64,${imageBlock.data}`,
							content: result.content,
						};
					}
				}
				if (typeof result?.screenshot === "string") {
					const alreadyDataUrl = result.screenshot.startsWith("data:image");
					return {
						success: true,
						imageDataUrl: alreadyDataUrl
							? result.screenshot
							: `data:image/png;base64,${result.screenshot}`,
						screenshot: result.screenshot,
					};
				}
			} catch {
				// Fall through to raw result
			}
			return {
				success: true,
				...result,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Screenshot failed",
			};
		}
	}

	async snapshot(verbose: boolean = false): Promise<SnapshotResult> {
		try {
			const result = await callBrowserTool("take_snapshot", { verbose });
			return {
				success: true,
				tree: result.tree || result,
				verbose,
				...result,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Snapshot failed",
			};
		}
	}

	async network(): Promise<NetworkResult> {
		try {
			const result = await callBrowserTool("list_network_requests", {});
			return {
				success: true,
				requests: result.requests || result,
				...result,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Network request failed",
			};
		}
	}

	async evaluate(script: string, args?: any[]): Promise<EvaluateResult> {
		try {
			const result = await callBrowserTool("evaluate_script", {
				function: script,
				args: args || [],
			});
			return {
				success: true,
				result,
				...result,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Evaluate failed",
			};
		}
	}

	async wait(text: string, timeout?: number): Promise<WaitResult> {
		try {
			const result = await callBrowserTool("wait_for", { text, timeout });
			return {
				success: true,
				message: result.message || `Waited for text: ${text}`,
				...result,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Wait failed",
			};
		}
	}

	async listPages(): Promise<ListPagesResult> {
		try {
			const result = await callBrowserTool("list_pages", {});
			return {
				success: true,
				pages: result.pages || result,
				...result,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "List pages failed",
			};
		}
	}

	async selectPage(pageId: number): Promise<SelectPageResult> {
		try {
			const result = await callBrowserTool("select_page", { pageId });
			return {
				success: true,
				message: `Switched to page ${pageId}`,
				...result,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Select page failed",
			};
		}
	}
}
