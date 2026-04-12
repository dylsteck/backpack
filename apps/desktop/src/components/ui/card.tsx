import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"rounded-2xl bg-card text-card-foreground shadow-sm ring-1 ring-border/50 dark:ring-border/40",
			className,
		)}
		{...props}
	/>
));
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex flex-col space-y-1.5 p-5", className)}
		{...props}
	/>
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"text-[15px] font-semibold leading-tight tracking-[-0.02em]",
			className,
		)}
		{...props}
	/>
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("text-[13px] leading-relaxed text-muted-foreground", className)}
		{...props}
	/>
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex items-center p-5 pt-0", className)}
		{...props}
	/>
));
CardFooter.displayName = "CardFooter";
