import React from "react";
import type { TransactionEntryData, TransactionGroup } from "./transactionUtils";

function formatCurrency(amount: number, currency: string): string {
	const formatter = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency.toUpperCase(),
		minimumFractionDigits: 2,
	});
	// Stripe amounts are in cents, so divide by 100
	return formatter.format(amount / 100);
}

export function TransactionEntry({
	entry,
	onClick,
}: {
	entry: TransactionEntryData | TransactionGroup;
	onClick?: () => void;
}) {
	// Guard against undefined/null entry
	if (!entry) {
		console.error("[TransactionEntry] Received undefined/null entry");
		return null;
	}

	if ("entries" in entry) {
		const group = entry as TransactionGroup;
		const totalAmount = group.entries.reduce((sum, e) => sum + e.amount, 0);
		const currency = group.entries[0]?.currency || "usd";
		const isPositive = totalAmount > 0;

		return (
			<div
				onClick={onClick}
				className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors space-y-2"
			>
				<div className="flex items-center gap-2">
					<div className={`w-8 h-8 rounded flex items-center justify-center ${
						isPositive ? "bg-green-500/10" : "bg-red-500/10"
					}`}>
						<span className={`text-xs font-medium ${
							isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
						}`}>
							{group.entries.length}
						</span>
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium">
							{group.entries.length} transactions
						</div>
						<div className="text-xs text-muted-foreground truncate">
							{group.entries[0]?.description || "Multiple transactions"}
						</div>
					</div>
					<div className={`text-sm font-medium ${
						isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
					}`}>
						{formatCurrency(totalAmount, currency)}
					</div>
				</div>
				{group.entries.length > 1 && (
					<div className="flex flex-wrap gap-1 mt-2">
						{group.entries.slice(0, 3).map((e, idx) => (
							<div
								key={idx}
								className="text-xs px-2 py-1 bg-muted rounded truncate max-w-[200px]"
								title={e.description}
							>
								{e.description || formatCurrency(e.amount, e.currency)}
							</div>
						))}
						{group.entries.length > 3 && (
							<div className="text-xs px-2 py-1 bg-muted rounded">
								+{group.entries.length - 3} more
							</div>
						)}
					</div>
				)}
			</div>
		);
	}

	const singleEntry = entry as TransactionEntryData;
	const isPositive = singleEntry.amount > 0;
	const formattedAmount = formatCurrency(singleEntry.amount, singleEntry.currency);

	return (
		<div
			onClick={onClick}
			className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors"
		>
			<div className="flex items-start gap-3">
				<div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
					isPositive ? "bg-green-500/10" : "bg-red-500/10"
				}`}>
					<span className={`text-xs ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
						{isPositive ? "+" : "-"}
					</span>
				</div>
				<div className="flex-1 min-w-0">
					<div className="text-sm font-medium line-clamp-2">
						{singleEntry.description || "Transaction"}
					</div>
					<div className="text-xs text-muted-foreground mt-1">
						{singleEntry.status === "pending" && (
							<span className="text-yellow-600 dark:text-yellow-400">Pending</span>
						)}
						{singleEntry.status === "posted" && (
							<span className="text-green-600 dark:text-green-400">Posted</span>
						)}
					</div>
				</div>
				<div className={`text-sm font-medium shrink-0 ${
					isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
				}`}>
					{formattedAmount}
				</div>
			</div>
		</div>
	);
}

