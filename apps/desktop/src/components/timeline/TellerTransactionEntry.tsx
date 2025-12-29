import React from "react";
import type { TellerTransaction } from "@cortex/api/services/teller/types";

export function TellerTransactionEntry({
	transaction,
	onClick,
}: {
	transaction: TellerTransaction;
	onClick?: () => void;
}) {
	// Parse amount (Teller returns amounts as strings, positive for credits, negative for debits)
	const amount = parseFloat(transaction.amount);
	const isCredit = amount > 0;
	const formattedAmount = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		signDisplay: "auto",
	}).format(amount);

	// Get merchant/counterparty name or fallback to description
	const merchantName = transaction.details?.counterparty?.name || transaction.description;
	const category = transaction.details?.category;
	const status = transaction.status;

	return (
		<div
			onClick={onClick}
			className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors"
		>
			<div className="flex items-center gap-3">
				{/* Transaction icon/indicator */}
				<div
					className={`w-10 h-10 rounded-full flex items-center justify-center ${
						isCredit
							? "bg-green-500/10 text-green-600 dark:text-green-400"
							: "bg-red-500/10 text-red-600 dark:text-red-400"
					}`}
				>
					<span className="text-lg font-semibold">
						{isCredit ? "+" : "−"}
					</span>
				</div>

				{/* Transaction details */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between gap-2">
						<div className="text-sm font-medium truncate">
							{merchantName}
						</div>
						<div
							className={`text-sm font-semibold ${
								isCredit
									? "text-green-600 dark:text-green-400"
									: "text-red-600 dark:text-red-400"
							}`}
						>
							{formattedAmount}
						</div>
					</div>

					{/* Category and status */}
					<div className="flex items-center gap-2 mt-1">
						{category && (
							<span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
								{category}
							</span>
						)}
						{status === "pending" && (
							<span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">
								Pending
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

