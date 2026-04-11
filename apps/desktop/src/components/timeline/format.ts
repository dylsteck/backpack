export function formatDateKey(timestamp: string | Date): string {
	const date = new Date(timestamp);
	return date.toISOString().slice(0, 10);
}

export function formatDateLabel(key: string): string {
	const date = new Date(`${key}T00:00:00`);
	const now = new Date();
	const today = now.toISOString().slice(0, 10);
	const yesterday = new Date(now.getTime() - 86_400_000)
		.toISOString()
		.slice(0, 10);
	if (key === today) return "Today";
	if (key === yesterday) return "Yesterday";
	return date.toLocaleDateString(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: now.getFullYear() === date.getFullYear() ? undefined : "numeric",
	});
}

export function formatTime(timestamp: string | Date): string {
	return new Date(timestamp).toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}

export function formatRelative(timestamp: string | Date): string {
	const then = new Date(timestamp).getTime();
	const diff = Date.now() - then;
	const minutes = Math.round(diff / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(timestamp).toLocaleDateString();
}
