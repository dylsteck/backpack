/** DD.MM.YYYY — matches compact history headers */
export function formatHistoryDayKey(ms: number): string {
	const d = new Date(ms);
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yyyy = d.getFullYear();
	return `${dd}.${mm}.${yyyy}`;
}

export function formatHistoryTime24(ms: number): string {
	return new Date(ms).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}
