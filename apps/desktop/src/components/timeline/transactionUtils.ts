export interface TransactionEntryData {
	id: string;
	account_id: string;
	amount: number;
	currency: string;
	description: string;
	status: string;
	transacted_at: number;
	created: number;
	timestamp: Date;
}

export interface TransactionGroup {
	id: string;
	entries: TransactionEntryData[];
	timestamp: Date;
}

export function groupTransactions(
	entries: TransactionEntryData[],
	windowMinutes: number = 7.5,
): (TransactionEntryData | TransactionGroup)[] {
	if (entries.length === 0) return [];

	const sorted = [...entries].sort((a, b) => {
		return b.timestamp.getTime() - a.timestamp.getTime();
	});

	const grouped: (TransactionEntryData | TransactionGroup)[] = [];
	const windowMs = windowMinutes * 60 * 1000;

	let currentGroup: TransactionEntryData[] = [];
	let groupStartTime: Date | null = null;

	for (const entry of sorted) {
		const entryTime = entry.timestamp;

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
						id: `group-${currentGroup[0].id}-${currentGroup[0].timestamp.getTime()}`,
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
				id: `group-${currentGroup[0].id}-${currentGroup[0].timestamp.getTime()}`,
				entries: currentGroup,
				timestamp: groupStartTime!,
			});
		} else {
			grouped.push(currentGroup[0]);
		}
	}

	return grouped;
}

