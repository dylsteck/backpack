import React from "react";
import type { TellerTransaction } from "@cortex/api/services/teller/types";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TellerTransactionExpandedView({
	transaction,
	onClose,
}: {
	transaction: TellerTransaction;
	onClose: () => void;
}) {
	// Parse amount (Teller returns amounts as strings, positive for credits, negative for debits)
	const amount = parseFloat(transaction.amount);
	const isCredit = amount > 0;
	const formattedAmount = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		signDisplay: "auto",
	}).format(amount);

	// Format date
	const transactionDate = new Date(transaction.date);
	const formattedDate = new Intl.DateTimeFormat("en-US", {
		dateStyle: "full",
	}).format(transactionDate);

	// Get details
	const merchantName = transaction.details?.counterparty?.name || transaction.description;
	const category = transaction.details?.category;
	const status = transaction.status;
	const runningBalance = transaction.running_balance
		? parseFloat(transaction.running_balance)
		: null;

	return (
		<div className="mt-3 pt-3 border-t border-border/50 space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div
						className={`w-10 h-10 rounded-full flex items-center justify-center ${
							isCredit
								? "bg-green-500/10 text-green-600 dark:text-green-400"
								: "bg-red-500/10 text-red-600 dark:text-red-400"
						}`}
					>
						<span className="text-lg font-bold">
							{isCredit ? "+" : "−"}
						</span>
					</div>
					<div>
						<h2 className="text-base font-bold">{merchantName}</h2>
						<p className="text-xs text-muted-foreground">{formattedDate}</p>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-6 w-6 rounded-full"
				>
					<X className="h-3 w-3" />
				</Button>
			</div>

			<div className="space-y-4">
				{/* Amount */}
				<div className="text-center py-2">
					<div
						className={`text-2xl font-bold ${
							isCredit
								? "text-green-600 dark:text-green-400"
								: "text-red-600 dark:text-red-400"
						}`}
					>
						{formattedAmount}
					</div>
					{status === "pending" && (
						<div className="mt-1 text-[10px] text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 inline-block px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
							Pending
						</div>
					)}
				</div>

				<Separator />

				{/* Transaction Details */}
				<div className="space-y-3">
					<div className="grid grid-cols-2 gap-x-4 gap-y-3">
						<div>
							<div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Status</div>
							<div className="text-xs font-medium capitalize">{status}</div>
						</div>

						{category && (
							<div>
								<div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Category</div>
								<div className="text-xs font-medium capitalize">{category}</div>
							</div>
						)}

						<div>
							<div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Type</div>
							<div className="text-xs font-medium capitalize">
								{isCredit ? "Credit" : "Debit"}
							</div>
						</div>

						{transaction.type && (
							<div>
								<div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Transaction Type</div>
								<div className="text-xs font-medium capitalize">{transaction.type}</div>
							</div>
						)}
					</div>

					{transaction.details?.counterparty && (
						<div>
							<div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Counterparty</div>
							<div className="text-xs font-medium">
								{transaction.details.counterparty.name}
								{transaction.details.counterparty.type && (
									<span className="text-[10px] text-muted-foreground ml-2">
										({transaction.details.counterparty.type})
									</span>
								)}
							</div>
						</div>
					)}

					{runningBalance !== null && (
						<div>
							<div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Balance After</div>
							<div className="text-xs font-medium">
								{new Intl.NumberFormat("en-US", {
									style: "currency",
									currency: "USD",
								}).format(runningBalance)}
							</div>
						</div>
					)}
				</div>

				<Separator />

				{/* Description */}
				<div>
					<h3 className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">
						Description
					</h3>
					<p className="text-xs leading-relaxed text-muted-foreground">{transaction.description}</p>
				</div>

				{/* Transaction ID */}
				<div className="pt-1">
					<div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">Transaction ID</div>
					<code className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono break-all text-muted-foreground">
						{transaction.id}
					</code>
				</div>
			</div>
		</div>
	);
}

