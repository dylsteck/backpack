const BRIDGE_PORT = process.env.BROWSER_BRIDGE_PORT || "3001";
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}/browser-tool`;

function bridgeErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

function isConnRefused(err: unknown): boolean {
	if (typeof err !== "object" || err === null) return false;
	const o = err as { code?: unknown; message?: unknown };
	return (
		o.code === "ECONNREFUSED" ||
		(typeof o.message === "string" && o.message.includes("ECONNREFUSED"))
	);
}

function mergeToolRecord(result: unknown): Record<string, unknown> {
	if (typeof result === "object" && result !== null && !Array.isArray(result)) {
		return result as Record<string, unknown>;
	}
	return {};
}

function isImageContentBlock(
	block: unknown,
): block is { type: string; data: string } {
	if (typeof block !== "object" || block === null) return false;
	const b = block as Record<string, unknown>;
	return b.type === "image" && typeof b.data === "string";
}

export interface NavigateResult {
	success: boolean;
	url?: string;
	action?: string;
	message?: string;
	result?: unknown;
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
	content?: unknown[];
	screenshot?: string;
	error?: string;
}

export interface SnapshotResult {
	success: boolean;
	tree?: unknown;
	verbose?: boolean;
	error?: string;
}

export interface NetworkResult {
	success: boolean;
	requests?: unknown[];
	error?: string;
}

export interface EvaluateResult {
	success: boolean;
	result?: unknown;
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

async function callBrowserTool(
	toolName: string,
	args: Record<string, unknown>,
): Promise<unknown> {
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

		const data = (await response.json()) as {
			success?: boolean;
			error?: string;
			result?: unknown;
		};
		if (!data.success) {
			throw new Error(data.error || "Tool call failed");
		}

		return data.result;
	} catch (error: unknown) {
		if (isConnRefused(error)) {
			throw new Error(
				"Browser bridge not available. Make sure the browser tab is open.",
			);
		}
		throw new Error(
			`Failed to call browser tool ${toolName}: ${bridgeErrorMessage(error)}`,
		);
	}
}

export class BrowserService {
	async navigate(
		url: string,
		type: "url" | "back" | "forward" | "reload" = "url",
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
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "Navigation failed",
			};
		}
	}

	async click(uid: string, dblClick: boolean = false): Promise<ClickResult> {
		try {
			const result = await callBrowserTool("click", { uid, dblClick });
			return {
				success: true,
				message: `Clicked element ${uid}`,
				...mergeToolRecord(result),
			};
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "Click failed",
			};
		}
	}

	async fill(uid: string, value: string): Promise<FillResult> {
		try {
			const result = await callBrowserTool("fill", { uid, value });
			return {
				success: true,
				message: `Filled element ${uid}`,
				...mergeToolRecord(result),
			};
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "Fill failed",
			};
		}
	}

	async screenshot(): Promise<ScreenshotResult> {
		try {
			const result = await callBrowserTool("take_screenshot", {});
			try {
				if (
					typeof result === "object" &&
					result !== null &&
					"content" in result &&
					Array.isArray((result as { content: unknown }).content)
				) {
					const content = (result as { content: unknown[] }).content;
					const imageBlock = content.find(isImageContentBlock);
					if (imageBlock?.data) {
						return {
							success: true,
							imageDataUrl: `data:image/png;base64,${imageBlock.data}`,
							content,
						};
					}
				}
				if (
					typeof result === "object" &&
					result !== null &&
					"screenshot" in result &&
					typeof (result as { screenshot: unknown }).screenshot === "string"
				) {
					const shot = (result as { screenshot: string }).screenshot;
					const alreadyDataUrl = shot.startsWith("data:image");
					return {
						success: true,
						imageDataUrl: alreadyDataUrl ? shot : `data:image/png;base64,${shot}`,
						screenshot: shot,
					};
				}
			} catch {
				// Fall through to raw result
			}
			return {
				success: true,
				...mergeToolRecord(result),
			};
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "Screenshot failed",
			};
		}
	}

	async snapshot(verbose: boolean = false): Promise<SnapshotResult> {
		try {
			const result = await callBrowserTool("take_snapshot", { verbose });
			const rec = mergeToolRecord(result);
			const tree =
				"tree" in rec && rec.tree !== undefined ? rec.tree : result;
			return {
				success: true,
				tree,
				verbose,
				...rec,
			};
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "Snapshot failed",
			};
		}
	}

	async network(): Promise<NetworkResult> {
		try {
			const result = await callBrowserTool("list_network_requests", {});
			const rec = mergeToolRecord(result);
			const rawRequests =
				rec.requests !== undefined ? rec.requests : result;
			const requests = Array.isArray(rawRequests)
				? rawRequests
				: rawRequests !== undefined && rawRequests !== null
					? [rawRequests]
					: undefined;
			return {
				success: true,
				requests,
				...rec,
			};
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "Network request failed",
			};
		}
	}

	async evaluate(script: string, args?: unknown[]): Promise<EvaluateResult> {
		try {
			const result = await callBrowserTool("evaluate_script", {
				function: script,
				args: args ?? [],
			});
			return {
				success: true,
				result,
				...mergeToolRecord(result),
			};
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "Evaluate failed",
			};
		}
	}

	async wait(text: string, timeout?: number): Promise<WaitResult> {
		try {
			const result = await callBrowserTool("wait_for", { text, timeout });
			const rec = mergeToolRecord(result);
			return {
				success: true,
				message:
					typeof rec.message === "string"
						? rec.message
						: `Waited for text: ${text}`,
				...rec,
			};
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "Wait failed",
			};
		}
	}

	async listPages(): Promise<ListPagesResult> {
		try {
			const result = await callBrowserTool("list_pages", {});
			const rec = mergeToolRecord(result);
			const rawPages = rec.pages !== undefined ? rec.pages : result;
			const pages = Array.isArray(rawPages)
				? (rawPages as NonNullable<ListPagesResult["pages"]>)
				: undefined;
			return {
				success: true,
				pages,
				...rec,
			};
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "List pages failed",
			};
		}
	}

	async selectPage(pageId: number): Promise<SelectPageResult> {
		try {
			const result = await callBrowserTool("select_page", { pageId });
			return {
				success: true,
				message: `Switched to page ${pageId}`,
				...mergeToolRecord(result),
			};
		} catch (error: unknown) {
			return {
				success: false,
				error: bridgeErrorMessage(error) || "Select page failed",
			};
		}
	}
}
