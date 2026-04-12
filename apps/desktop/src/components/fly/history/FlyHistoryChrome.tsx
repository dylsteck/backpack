import { Link } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

type Props = {
	filter: string;
	onFilterChange: (v: string) => void;
	deletePending: boolean;
	onDeleteAll: () => void;
};

export function FlyHistoryChrome({
	filter,
	onFilterChange,
	deletePending,
	onDeleteAll,
}: Props) {
	return (
		<>
			<header className="flex h-10 shrink-0 items-center gap-2 border-b bg-secondary/40 px-2 md:px-3">
				<SidebarTrigger className="no-drag size-7 shrink-0 [&_svg]:size-3.5" />
				<Link
					to="/fly/browser"
					className="no-drag flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
					title="Back to browser"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
				</Link>
				<h1 className="text-sm font-semibold text-foreground">Fly history</h1>
				<div className="flex-1" />
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 gap-1 text-destructive hover:text-destructive"
					disabled={deletePending}
					onClick={onDeleteAll}
				>
					<Trash2 className="h-3 w-3" />
					Delete all
				</Button>
			</header>

			<div className="border-b px-4 py-3">
				<input
					type="search"
					value={filter}
					onChange={(e) => onFilterChange(e.target.value)}
					placeholder="Filter visits or searches…"
					className="h-9 w-full max-w-md rounded-lg border border-border/60 bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
				/>
				<p className="mt-2 text-xs text-muted-foreground">
					Local SQLite only · last 30 days shown for lists · analytics use the same range
				</p>
			</div>
		</>
	);
}
