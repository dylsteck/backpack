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
		<div className="flex items-center gap-0.5 rounded-xl bg-secondary/55 p-1 text-[12px] shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.06)] dark:shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)]">
			{all.map((opt) => (
				<button
					key={opt.value}
					type="button"
					onClick={() => setSource(opt.value)}
					className={cn(
						"rounded-lg px-2.5 py-1.5 transition-all duration-200 ease-out",
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
