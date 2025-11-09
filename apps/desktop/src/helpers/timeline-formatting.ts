/**
 * Timeline formatting utilities for consistent date and time display
 */

/**
 * Formats a timestamp to a time string (e.g., "3:45 PM")
 * @param timestamp - The timestamp to format
 * @returns Formatted time string
 */
export function formatTime(timestamp: Date): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * Formats a timestamp to a date string, returning empty string for today/yesterday
 * @param timestamp - The timestamp to format
 * @returns Formatted date string or empty string for today/yesterday
 */
export function formatDate(timestamp: Date): string {
	const date = new Date(timestamp);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	if (date.toDateString() === today.toDateString()) {
		return "";
	}
	if (date.toDateString() === yesterday.toDateString()) {
		return "";
	}
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Formats a timestamp to a full date string for date separators
 * @param timestamp - The timestamp to format
 * @returns Formatted date string (e.g., "Tuesday, November 4, 2025")
 */
export function formatFullDate(timestamp: Date): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

/**
 * Groups timeline items by date
 * @param items - Array of items with timestamp property
 * @returns Array of [dateKey, items] tuples sorted by date (newest first)
 */
export function groupItemsByDate<T extends { timestamp: Date }>(items: T[]): Array<[string, T[]]> {
	const groups: Map<string, T[]> = new Map();

	for (const item of items) {
		const dateKey = new Date(item.timestamp).toDateString();
		if (!groups.has(dateKey)) {
			groups.set(dateKey, []);
		}
		groups.get(dateKey)!.push(item);
	}

	return Array.from(groups.entries()).sort((a, b) => {
		return new Date(b[0]).getTime() - new Date(a[0]).getTime();
	});
}

