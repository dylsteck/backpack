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
		<div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
			<div className="bg-background border rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
				{/* Header */}
				<div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div
							className={`w-12 h-12 rounded-full flex items-center justify-center ${
								isCredit
									? "bg-green-500/10 text-green-600 dark:text-green-400"
									: "bg-red-500/10 text-red-600 dark:text-red-400"
							}`}
						>
							<span className="text-xl font-bold">
								{isCredit ? "+" : "−"}
							</span>
						</div>
						<div>
							<h2 className="text-xl font-bold">{merchantName}</h2>
							<p className="text-sm text-muted-foreground">{formattedDate}</p>
						</div>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="rounded-full"
					>
						<X className="h-5 w-5" />
					</Button>
				</div>

				{/* Content */}
				<div className="p-6 space-y-4">
					{/* Amount */}
					<div className="text-center py-6">
						<div
							className={`text-4xl font-bold ${
								isCredit
									? "text-green-600 dark:text-green-400"
									: "text-red-600 dark:text-red-400"
							}`}
						>
							{formattedAmount}
						</div>
						{status === "pending" && (
							<div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 inline-block px-3 py-1 rounded-full">
								Pending Transaction
							</div>
						)}
					</div>

					<Separator />

					{/* Transaction Details */}
					<div className="space-y-3">
						<h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
							Transaction Details
						</h3>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<div className="text-xs text-muted-foreground">Status</div>
								<div className="text-sm font-medium capitalize">{status}</div>
							</div>

							{category && (
								<div>
									<div className="text-xs text-muted-foreground">Category</div>
									<div className="text-sm font-medium capitalize">{category}</div>
								</div>
							)}

							<div>
								<div className="text-xs text-muted-foreground">Type</div>
								<div className="text-sm font-medium capitalize">
									{isCredit ? "Credit" : "Debit"}
								</div>
							</div>

							{transaction.type && (
								<div>
									<div className="text-xs text-muted-foreground">Transaction Type</div>
									<div className="text-sm font-medium capitalize">{transaction.type}</div>
								</div>
							)}
						</div>

						{transaction.details?.counterparty && (
							<div>
								<div className="text-xs text-muted-foreground">Counterparty</div>
								<div className="text-sm font-medium">
									{transaction.details.counterparty.name}
									{transaction.details.counterparty.type && (
										<span className="text-xs text-muted-foreground ml-2">
											({transaction.details.counterparty.type})
										</span>
									)}
								</div>
							</div>
						)}

						{runningBalance !== null && (
							<div>
								<div className="text-xs text-muted-foreground">Balance After Transaction</div>
								<div className="text-sm font-medium">
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
						<h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
							Description
						</h3>
						<p className="text-sm">{transaction.description}</p>
					</div>

					{/* Transaction ID */}
					<div>
						<div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
						<code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
							{transaction.id}
						</code>
					</div>
				</div>
			</div>
		</div>
	);
}

