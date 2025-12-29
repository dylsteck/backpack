import React from "react";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterOption } from "./FilterBar";
import { cn } from "@/utils/tailwind";

export type SourceType = "farcaster" | "chrome" | "brave" | "all";

export interface SourceFilterProps {
	selectedSources: SourceType[];
	onSourceChange: (sources: SourceType[]) => void;
	sourceCounts?: Record<SourceType, number>;
	className?: string;
}

const SOURCE_OPTIONS: FilterOption<SourceType>[] = [
	{ value: "all", label: "All" },
	{ value: "farcaster", label: "Farcaster" },
	{ value: "chrome", label: "Chrome" },
	{ value: "brave", label: "Brave" },
];

/**
 * Filter component for filtering timeline items by source.
 * Supports multiple source selection with an "All" option.
 */
export function SourceFilter({
	selectedSources,
	onSourceChange,
	sourceCounts,
	className,
}: SourceFilterProps) {
	const handleSourceToggle = (source: SourceType) => {
		if (source === "all") {
			onSourceChange(["all"]);
		} else {
			const newSources = selectedSources.includes("all")
				? [source]
				: selectedSources.includes(source)
					? selectedSources.filter((s) => s !== source)
					: [...selectedSources.filter((s) => s !== "all"), source];

			// If no sources selected, default to "all"
			if (newSources.length === 0) {
				onSourceChange(["all"]);
			} else {
				onSourceChange(newSources);
			}
		}
	};

	return (
		<FilterBar className={className}>
			<span className="text-sm font-medium text-muted-foreground mr-2">Filter:</span>
			<div className="flex items-center gap-2 flex-wrap">
				{SOURCE_OPTIONS.map((option) => {
					const isSelected = selectedSources.includes(option.value);
					const count = sourceCounts?.[option.value];

					return (
						<Button
							key={option.value}
							variant={isSelected ? "default" : "outline"}
							size="sm"
							onClick={() => handleSourceToggle(option.value)}
							className={cn(
								"h-7 text-xs",
								isSelected && "bg-primary text-primary-foreground"
							)}
						>
							{option.label}
							{count !== undefined && count > 0 && (
								<span className="ml-1.5 px-1.5 py-0.5 bg-background/20 rounded text-[10px]">
									{count}
								</span>
							)}
						</Button>
					);
				})}
			</div>
		</FilterBar>
	);
}

