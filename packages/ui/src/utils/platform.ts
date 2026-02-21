export function isTauri(): boolean {
	return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

export function isWeb(): boolean {
	return typeof window !== "undefined" && !isTauri();
}

/** Open URL in system browser (desktop) or navigate (web). For OAuth flows. */
export async function openExternalUrl(url: string): Promise<void> {
	const tauri = (window as unknown as { __TAURI__?: { shell?: { open: (url: string) => Promise<void> } } }).__TAURI__;
	if (isTauri() && tauri?.shell?.open) {
		await tauri.shell.open(url);
	} else {
		window.location.href = url;
	}
}

/** Open native folder picker (desktop only). Returns path or null. */
export async function pickFolder(): Promise<string | null> {
	if (!isTauri()) return null;
	const dialog = (window as unknown as { __TAURI__?: { dialog?: { open: (opts?: { directory?: boolean }) => Promise<string | string[] | null> } } }).__TAURI__?.dialog;
	if (!dialog?.open) return null;
	const result = await dialog.open({ directory: true });
	return typeof result === "string" ? result : Array.isArray(result) && result[0] ? result[0] : null;
}
