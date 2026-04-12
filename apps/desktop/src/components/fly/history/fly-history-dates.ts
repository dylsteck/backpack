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

function parseHistoryDayKey(dayKey: string): Date {
	const [dd, mm, yyyy] = dayKey.split(".").map(Number);
	return new Date(yyyy, mm - 1, dd);
}

function isSameLocalCalendarDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** Display label for a DD.MM.YYYY bucket (today / yesterday / locale date). */
export function formatHistorySectionTitle(dayKey: string): string {
	const d = parseHistoryDayKey(dayKey);
	const now = new Date();
	if (isSameLocalCalendarDay(d, now)) {
		return "today";
	}
	const y = new Date(now);
	y.setDate(y.getDate() - 1);
	if (isSameLocalCalendarDay(d, y)) {
		return "yesterday";
	}
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
