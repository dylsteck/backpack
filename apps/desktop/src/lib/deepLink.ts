/**
 * Deep link handling utilities
 */

export interface DeepLinkCallbackData {
	success: boolean;
	sessionToken: string | null;
	accountIds: string[];
	customerId: string | null;
	// Teller-specific fields
	accessToken?: string | null;
	enrollmentId?: string | null;
	institutionName?: string | null;
	error: string | null;
}

/**
 * Parse deep link URL and extract callback data
 */
export function parseDeepLink(url: string): DeepLinkCallbackData | null {
	try {
		const urlObj = new URL(url);
		if (urlObj.protocol !== "cortex:") {
			return null;
		}

		const params = new URLSearchParams(urlObj.search);
		return {
			success: params.get("success") === "true",
			sessionToken: params.get("sessionToken"),
			accountIds: params.get("accountIds")?.split(",").filter(Boolean) || [],
			customerId: params.get("customerId"),
			// Teller-specific fields
			accessToken: params.get("accessToken"),
			enrollmentId: params.get("enrollmentId"),
			institutionName: params.get("institutionName"),
			error: params.get("error"),
		};
	} catch (error) {
		console.error("Error parsing deep link:", error);
		return null;
	}
}

/**
 * Set up deep link listener using Electron IPC
 * Returns cleanup function
 */
export function setupDeepLinkListener(
	callback: (data: DeepLinkCallbackData) => void
): () => void {
	// Check if we're in Electron
	if (typeof window === "undefined" || !(window as any).electronDeepLink) {
		console.warn("Deep link listener: Not in Electron environment or deep link context not exposed");
		return () => {};
	}

	const electronDeepLink = (window as any).electronDeepLink;

	// Listen for deep link callback from main process
	const handleDeepLink = (data: DeepLinkCallbackData) => {
		callback(data);
	};

	// Register listener
	if (electronDeepLink.onCallback) {
		electronDeepLink.onCallback(handleDeepLink);
	}

	// Return cleanup function
	return () => {
		if (electronDeepLink.removeCallback) {
			electronDeepLink.removeCallback();
		}
	};
}

