import React from "react";
import { cn } from "@/utils/tailwind";

export interface FilterOption<T = string> {
	value: T;
	label: string;
	count?: number;
}

export interface FilterBarProps {
	children: React.ReactNode;
	className?: string;
}

/**
 * Base filter bar component that provides consistent styling and layout
 * for filter controls across the application.
 */
export function FilterBar({ children, className }: FilterBarProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 px-4 py-2 bg-background/95 backdrop-blur-sm border-b sticky top-[44px] z-30",
				className
			)}
		>
			{children}
		</div>
	);
}

