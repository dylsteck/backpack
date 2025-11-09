import React from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/utils/tailwind";

export interface FilterDropdownProps {
	children: React.ReactNode;
	label?: string;
	activeCount?: number;
	className?: string;
}

/**
 * Base filter dropdown component for the topbar.
 * Displays a filter icon with optional label and active filter count badge.
 */
export function FilterDropdown({
	children,
	label = "Filter",
	activeCount = 0,
	className,
}: FilterDropdownProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"h-8 gap-2 text-xs font-normal text-muted-foreground hover:text-foreground",
						className
					)}
				>
					<Filter className="h-4 w-4" />
					<span>{label}</span>
					{activeCount > 0 && (
						<span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
							{activeCount}
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

