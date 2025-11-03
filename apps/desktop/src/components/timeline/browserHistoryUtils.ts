import type { BrowserHistoryEntryData, BrowserHistoryGroup } from "./BrowserHistoryEntry";

export function groupBrowserHistory(
	entries: BrowserHistoryEntryData[],
	windowMinutes: number = 7.5,
): (BrowserHistoryEntryData | BrowserHistoryGroup)[] {
	if (entries.length === 0) return [];

	const sorted = [...entries].sort((a, b) => {
		return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
	});

	const grouped: (BrowserHistoryEntryData | BrowserHistoryGroup)[] = [];
	const windowMs = windowMinutes * 60 * 1000;

	let currentGroup: BrowserHistoryEntryData[] = [];
	let groupStartTime: Date | null = null;

	for (const entry of sorted) {
		const entryTime = new Date(entry.timestamp);

		if (groupStartTime === null) {
			currentGroup = [entry];
			groupStartTime = entryTime;
		} else {
			const timeDiff = groupStartTime.getTime() - entryTime.getTime();

			if (timeDiff <= windowMs) {
				currentGroup.push(entry);
			} else {
				if (currentGroup.length > 1) {
					grouped.push({
						id: `group-${currentGroup[0].url}-${currentGroup[0].timestamp}`,
						entries: currentGroup,
						timestamp: groupStartTime,
					});
				} else {
					grouped.push(currentGroup[0]);
				}
				currentGroup = [entry];
				groupStartTime = entryTime;
			}
		}
	}

	if (currentGroup.length > 0) {
		if (currentGroup.length > 1) {
			grouped.push({
				id: `group-${currentGroup[0].url}-${currentGroup[0].timestamp}`,
				entries: currentGroup,
				timestamp: groupStartTime!,
			});
		} else {
			grouped.push(currentGroup[0]);
		}
	}

	return grouped;
}
