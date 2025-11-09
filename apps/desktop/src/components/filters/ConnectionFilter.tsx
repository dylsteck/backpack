import React from "react";
import { Button } from "@/components/ui/button";
import { FilterBar } from "./FilterBar";
import { cn } from "@/utils/tailwind";

export type ConnectionType = "mcp" | "api" | "file" | "all";
export type ConnectionStatus = "connected" | "disconnected" | "all";

export interface ConnectionFilterProps {
	selectedTypes: ConnectionType[];
	selectedStatus: ConnectionStatus;
	onTypeChange: (types: ConnectionType[]) => void;
	onStatusChange: (status: ConnectionStatus) => void;
	className?: string;
}

const CONNECTION_TYPE_OPTIONS = [
	{ value: "all" as ConnectionType, label: "All Types" },
	{ value: "mcp" as ConnectionType, label: "MCP" },
	{ value: "api" as ConnectionType, label: "API" },
	{ value: "file" as ConnectionType, label: "File" },
];

const CONNECTION_STATUS_OPTIONS = [
	{ value: "all" as ConnectionStatus, label: "All" },
	{ value: "connected" as ConnectionStatus, label: "Connected" },
	{ value: "disconnected" as ConnectionStatus, label: "Disconnected" },
];

/**
 * Filter component for filtering apps by connection type and status.
 * Supports multiple connection type selection and single status selection.
 */
export function ConnectionFilter({
	selectedTypes,
	selectedStatus,
	onTypeChange,
	onStatusChange,
	className,
}: ConnectionFilterProps) {
	const handleTypeToggle = (type: ConnectionType) => {
		if (type === "all") {
			onTypeChange(["all"]);
		} else {
			const newTypes = selectedTypes.includes("all")
				? [type]
				: selectedTypes.includes(type)
					? selectedTypes.filter((t) => t !== type)
					: [...selectedTypes.filter((t) => t !== "all"), type];

			// If no types selected, default to "all"
			if (newTypes.length === 0) {
				onTypeChange(["all"]);
			} else {
				onTypeChange(newTypes);
			}
		}
	};

	return (
		<FilterBar className={className}>
			<span className="text-sm font-medium text-muted-foreground mr-2">Filter:</span>
			<div className="flex items-center gap-4 flex-wrap">
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">Type:</span>
					{CONNECTION_TYPE_OPTIONS.map((option) => {
						const isSelected = selectedTypes.includes(option.value);

						return (
							<Button
								key={option.value}
								variant={isSelected ? "default" : "outline"}
								size="sm"
								onClick={() => handleTypeToggle(option.value)}
								className={cn(
									"h-7 text-xs",
									isSelected && "bg-primary text-primary-foreground"
								)}
							>
								{option.label}
							</Button>
						);
					})}
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">Status:</span>
					{CONNECTION_STATUS_OPTIONS.map((option) => {
						const isSelected = selectedStatus === option.value;

						return (
							<Button
								key={option.value}
								variant={isSelected ? "default" : "outline"}
								size="sm"
								onClick={() => onStatusChange(option.value)}
								className={cn(
									"h-7 text-xs",
									isSelected && "bg-primary text-primary-foreground"
								)}
							>
								{option.label}
							</Button>
						);
					})}
				</div>
			</div>
		</FilterBar>
	);
}

