import React from "react";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FilterDropdown } from "./FilterDropdown";

export type ConnectionType = "mcp" | "api" | "file" | "all";
export type ConnectionStatus = "connected" | "disconnected" | "all";

export interface ConnectionFilterDropdownProps {
	selectedTypes: ConnectionType[];
	selectedStatus: ConnectionStatus;
	onTypeChange: (types: ConnectionType[]) => void;
	onStatusChange: (status: ConnectionStatus) => void;
}

const CONNECTION_TYPE_OPTIONS = [
	{ value: "all" as ConnectionType, label: "All Types" },
	{ value: "mcp" as ConnectionType, label: "MCP" },
	{ value: "api" as ConnectionType, label: "API" },
	{ value: "file" as ConnectionType, label: "File" },
];

const CONNECTION_STATUS_OPTIONS = [
	{ value: "all" as ConnectionStatus, label: "All Statuses" },
	{ value: "connected" as ConnectionStatus, label: "Connected" },
	{ value: "disconnected" as ConnectionStatus, label: "Disconnected" },
];

/**
 * Dropdown filter component for filtering apps by connection type and status.
 * Displays in the topbar with a filter icon and active count badge.
 */
export function ConnectionFilterDropdown({
	selectedTypes,
	selectedStatus,
	onTypeChange,
	onStatusChange,
}: ConnectionFilterDropdownProps) {
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

	const activeCount =
		(selectedTypes.includes("all") ? 0 : selectedTypes.length) +
		(selectedStatus === "all" ? 0 : 1);

	return (
		<FilterDropdown label="Filter" activeCount={activeCount}>
			<DropdownMenuLabel>Connection Type</DropdownMenuLabel>
			<DropdownMenuSeparator />
			<DropdownMenuGroup>
				{CONNECTION_TYPE_OPTIONS.map((option) => {
					const isSelected = selectedTypes.includes(option.value);

					return (
						<DropdownMenuCheckboxItem
							key={option.value}
							checked={isSelected}
							onCheckedChange={() => handleTypeToggle(option.value)}
						>
							{option.label}
						</DropdownMenuCheckboxItem>
					);
				})}
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			<DropdownMenuLabel>Connection Status</DropdownMenuLabel>
			<DropdownMenuSeparator />
			<DropdownMenuRadioGroup
				value={selectedStatus}
				onValueChange={(value) => onStatusChange(value as ConnectionStatus)}
			>
				{CONNECTION_STATUS_OPTIONS.map((option) => (
					<DropdownMenuRadioItem key={option.value} value={option.value}>
						{option.label}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
		</FilterDropdown>
	);
}

