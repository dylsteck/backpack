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
		<div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-0.5 text-[12px]">
			{all.map((opt) => (
				<button
					key={opt.value}
					type="button"
					onClick={() => setSource(opt.value)}
					className={cn(
						"rounded-md px-2.5 py-1 transition-colors",
						source === opt.value
							? "bg-card text-foreground shadow-sm"
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
