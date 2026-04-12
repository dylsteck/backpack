import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
	<input
		type={type}
		ref={ref}
		className={cn(
			"flex h-9 w-full rounded-lg border border-border/60 bg-card px-3 py-1 text-[13px] shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50",
			className,
		)}
		{...props}
	/>
));
Input.displayName = "Input";
