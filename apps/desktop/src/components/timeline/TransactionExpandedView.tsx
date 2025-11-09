import React from "react";
import type { TransactionEntryData, TransactionGroup } from "./transactionUtils";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatCurrency(amount: number, currency: string): string {
	const formatter = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency.toUpperCase(),
		minimumFractionDigits: 2,
	});
	return formatter.format(amount / 100);
}

export function TransactionExpandedView({
	entry,
	onClose,
}: {
	entry: TransactionEntryData | TransactionGroup;
	onClose: () => void;
}) {
	if ("entries" in entry) {
		const group = entry as TransactionGroup;
		const totalAmount = group.entries.reduce((sum, e) => sum + e.amount, 0);
		const currency = group.entries[0]?.currency || "usd";
		const isPositive = totalAmount > 0;

		return (
			<div className="mt-3 pt-3 border-t border-border/50 space-y-3">
				<div className="flex items-center justify-between">
					<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						{group.entries.length} transactions
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-6 w-6 -mr-2"
					>
						<X className="h-3 w-3" />
					</Button>
				</div>

				<div className="space-y-1.5">
					<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Amount</div>
					<div className={`text-lg font-semibold ${
						isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
					}`}>
						{formatCurrency(totalAmount, currency)}
					</div>
				</div>

				<div className="space-y-3 max-h-64 overflow-y-auto pr-2">
					{group.entries.map((e, idx) => {
						const isPositive = e.amount > 0;
						return (
							<div key={idx} className="space-y-1.5">
								<div className="flex items-center justify-between">
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium">{e.description || "Transaction"}</div>
										<div className="text-xs text-muted-foreground">
											{new Date(e.transacted_at * 1000).toLocaleString()}
										</div>
									</div>
									<div className={`text-sm font-medium shrink-0 ${
										isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
									}`}>
										{formatCurrency(e.amount, e.currency)}
									</div>
								</div>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<span>Status: {e.status}</span>
									<span>•</span>
									<span>Account: {e.account_id.slice(0, 8)}...</span>
								</div>
								{idx < group.entries.length - 1 && <Separator className="mt-2" />}
							</div>
						);
					})}
				</div>
			</div>
		);
	}

	const singleEntry = entry as TransactionEntryData;
	const isPositive = singleEntry.amount > 0;

	return (
		<div className="mt-3 pt-3 border-t border-border/50 space-y-3">
			<div className="flex items-center justify-between">
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-6 w-6 -ml-2"
				>
					<X className="h-3 w-3" />
				</Button>
			</div>

			<div className="space-y-2.5">
				<div>
					<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Amount</div>
					<div className={`text-xl font-semibold ${
						isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
					}`}>
						{formatCurrency(singleEntry.amount, singleEntry.currency)}
					</div>
				</div>

				<div>
					<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Description</div>
					<div className="text-sm break-words leading-relaxed">
						{singleEntry.description || "No description"}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<span>Status: {singleEntry.status}</span>
					<span>•</span>
					<span>Account: {singleEntry.account_id.slice(0, 8)}...</span>
					<span>•</span>
					<span>{new Date(singleEntry.transacted_at * 1000).toLocaleString()}</span>
				</div>
			</div>
		</div>
	);
}

