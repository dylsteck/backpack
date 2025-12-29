import React from "react";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FilterDropdown } from "./FilterDropdown";

export type SourceType = "farcaster" | "chrome" | "brave" | "all";

export interface SourceFilterDropdownProps {
	selectedSources: SourceType[];
	onSourceChange: (sources: SourceType[]) => void;
	sourceCounts?: Record<SourceType, number>;
}

const SOURCE_OPTIONS: Array<{ value: SourceType; label: string }> = [
	{ value: "all", label: "All Sources" },
	{ value: "farcaster", label: "Farcaster" },
	{ value: "chrome", label: "Chrome" },
	{ value: "brave", label: "Brave" },
];

/**
 * Dropdown filter component for filtering timeline items by source.
 * Displays in the topbar with a filter icon and active count badge.
 */
export function SourceFilterDropdown({
	selectedSources,
	onSourceChange,
	sourceCounts,
}: SourceFilterDropdownProps) {
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

	const activeCount = selectedSources.includes("all") ? 0 : selectedSources.length;

	return (
		<FilterDropdown label="Filter" activeCount={activeCount}>
			<DropdownMenuLabel>Filter by Source</DropdownMenuLabel>
			<DropdownMenuSeparator />
			<DropdownMenuGroup>
				{SOURCE_OPTIONS.map((option) => {
					const isSelected = selectedSources.includes(option.value);
					const count = sourceCounts?.[option.value];

					return (
						<DropdownMenuCheckboxItem
							key={option.value}
							checked={isSelected}
							onCheckedChange={() => handleSourceToggle(option.value)}
						>
							{option.label}
							{count !== undefined && count > 0 && (
								<span className="ml-auto text-xs text-muted-foreground">
									{count}
								</span>
							)}
						</DropdownMenuCheckboxItem>
					);
				})}
			</DropdownMenuGroup>
		</FilterDropdown>
	);
}

