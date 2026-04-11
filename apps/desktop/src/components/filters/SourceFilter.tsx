import { cn } from "@/lib/utils";
import { useFilters } from "@/contexts/FilterContext";

interface SourceOption {
	value: string;
	label: string;
	count?: number;
}

export function SourceFilter({ options }: { options: SourceOption[] }) {
	const { source, setSource } = useFilters();
	const all = [{ value: "all", label: "All" }, ...options];

	return (
		<div className="flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs">
			{all.map((opt) => (
				<button
					key={opt.value}
					type="button"
					onClick={() => setSource(opt.value)}
					className={cn(
						"rounded-sm px-2.5 py-1 transition-colors",
						source === opt.value
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{opt.label}
					{typeof opt.count === "number" && (
						<span className="ml-1.5 text-muted-foreground">{opt.count}</span>
					)}
				</button>
			))}
		</div>
	);
}
