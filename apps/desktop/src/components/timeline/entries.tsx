import type { Item } from "@backpack/sdk";
import {
	Globe,
	MessageSquare,
	CreditCard,
	FileText,
	ExternalLink,
} from "lucide-react";
import { formatTime } from "./format";
import { cn } from "@/lib/utils";

function pickString(data: Record<string, unknown>, keys: string[]): string {
	for (const key of keys) {
		const value = data[key];
		if (typeof value === "string" && value.length > 0) return value;
	}
	return "";
}

function pickNumber(
	data: Record<string, unknown>,
	keys: string[],
): number | null {
	for (const key of keys) {
		const value = data[key];
		if (typeof value === "number") return value;
	}
	return null;
}

function EntryShell({
	icon: Icon,
	accent,
	meta,
	title,
	children,
	onClick,
}: {
	icon: typeof Globe;
	accent: string;
	meta: string;
	title: string;
	children?: React.ReactNode;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="group flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
		>
			<div
				className={cn(
					"flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
					accent,
				)}
			>
				<Icon className="h-4 w-4" />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="flex items-baseline justify-between gap-2">
					<span className="truncate text-sm font-medium">{title}</span>
					<span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
				</div>
				{children}
			</div>
		</button>
	);
}

export function CastEntry({
	item,
	onClick,
}: {
	item: Item;
	onClick?: () => void;
}) {
	const data = item.data as Record<string, unknown>;
	const author = pickString(data, ["author", "username", "displayName"]);
	const text = pickString(data, ["text", "content", "body"]);
	const likes = pickNumber(data, ["likes", "reactions"]);

	return (
		<EntryShell
			icon={MessageSquare}
			accent="bg-purple-500/10 text-purple-500"
			meta={formatTime(item.timestamp)}
			title={author || "Cast"}
			onClick={onClick}
		>
			{text && (
				<p className="line-clamp-2 text-sm text-muted-foreground">{text}</p>
			)}
			{likes !== null && (
				<span className="text-xs text-muted-foreground">
					{likes} likes
				</span>
			)}
		</EntryShell>
	);
}

export function BrowserHistoryEntry({
	item,
	onClick,
}: {
	item: Item;
	onClick?: () => void;
}) {
	const data = item.data as Record<string, unknown>;
	const title = pickString(data, ["title", "name"]);
	const url = pickString(data, ["url", "href"]);
	const visits = pickNumber(data, ["visitCount", "visits"]);
	const host = (() => {
		try {
			return new URL(url).hostname;
		} catch {
			return "";
		}
	})();

	return (
		<EntryShell
			icon={Globe}
			accent="bg-sky-500/10 text-sky-500"
			meta={formatTime(item.timestamp)}
			title={title || url || "Page visit"}
			onClick={onClick}
		>
			{host && (
				<span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
					<ExternalLink className="h-3 w-3" />
					{host}
					{visits ? ` · ${visits} visits` : ""}
				</span>
			)}
		</EntryShell>
	);
}

export function TellerTransactionEntry({
	item,
	onClick,
}: {
	item: Item;
	onClick?: () => void;
}) {
	const data = item.data as Record<string, unknown>;
	const desc = pickString(data, ["description", "merchant", "name"]);
	const amount = pickNumber(data, ["amount"]);
	const category = pickString(data, ["category"]);
	const isCredit = typeof amount === "number" && amount >= 0;

	return (
		<EntryShell
			icon={CreditCard}
			accent={
				isCredit
					? "bg-emerald-500/10 text-emerald-500"
					: "bg-rose-500/10 text-rose-500"
			}
			meta={formatTime(item.timestamp)}
			title={desc || "Transaction"}
			onClick={onClick}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs text-muted-foreground">
					{category || item.type}
				</span>
				{amount !== null && (
					<span
						className={cn(
							"text-sm font-semibold tabular-nums",
							isCredit ? "text-emerald-500" : "text-rose-500",
						)}
					>
						{isCredit ? "+" : ""}
						{amount.toFixed(2)}
					</span>
				)}
			</div>
		</EntryShell>
	);
}

export function GenericEntry({
	item,
	onClick,
}: {
	item: Item;
	onClick?: () => void;
}) {
	const data = item.data as Record<string, unknown>;
	const title = pickString(data, ["title", "name", "description", "url", "text"]);
	const snippet = pickString(data, ["snippet", "body", "text", "url"]);

	return (
		<EntryShell
			icon={FileText}
			accent="bg-muted text-muted-foreground"
			meta={formatTime(item.timestamp)}
			title={title || "(untitled)"}
			onClick={onClick}
		>
			{snippet && (
				<p className="line-clamp-2 text-sm text-muted-foreground">{snippet}</p>
			)}
		</EntryShell>
	);
}

export function TimelineEntry({
	item,
	onClick,
}: {
	item: Item;
	onClick?: () => void;
}) {
	if (item.type === "cast" || item.source === "farcaster")
		return <CastEntry item={item} onClick={onClick} />;
	if (item.type === "browser-history" || item.type === "browser_history")
		return <BrowserHistoryEntry item={item} onClick={onClick} />;
	if (item.type === "transaction" || item.source === "teller")
		return <TellerTransactionEntry item={item} onClick={onClick} />;
	return <GenericEntry item={item} onClick={onClick} />;
}
