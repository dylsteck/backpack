import { Card, Badge } from "@cortex/ui/components";
import type { CursorServer } from "@/types/mcp";
import { useState } from "react";

interface MCPServerCardProps {
	server: CursorServer;
	onClick?: () => void;
}

export default function MCPServerCard({ server, onClick }: MCPServerCardProps) {
	const [iconError, setIconError] = useState(false);

	// Extract display name - simplify by taking last part after / or just use name
	const displayName = server.name.includes("/")
		? server.name.split("/").pop()!.charAt(0).toUpperCase() + server.name.split("/").pop()!.slice(1)
		: server.name;

	// Generate a subtle color based on server name for fallback icon
	const getAccentColor = (text: string) => {
		const colors = [
			"bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
			"bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
			"bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800",
			"bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
			"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
			"bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
			"bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
			"bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
		];
		const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return colors[hash % colors.length];
	};

	const accentClass = getAccentColor(server.name);
	const showIcon = server.iconUrl && !iconError;

	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		console.log("Card clicked!", server.name, "onClick exists:", !!onClick);
		if (onClick) {
			console.log("Calling onClick handler");
			onClick();
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			if (onClick) {
				onClick();
			}
		}
	};

	return (
		<Card 
			className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-200 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={0}
		>
			<div className="flex flex-col gap-4 h-full pointer-events-none">
				<div className="flex items-start justify-between">
					<div className="shrink-0">
						{showIcon ? (
							<img
								src={server.iconUrl}
								alt={`${server.name} icon`}
								className="w-12 h-12 rounded-xl object-contain pointer-events-none"
								onError={() => setIconError(true)}
								draggable={false}
							/>
						) : (
							<div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-semibold border ${accentClass} pointer-events-none`}>
								{displayName.charAt(0)}
							</div>
						)}
					</div>
					{server.oauth && (
						<Badge variant="outline" className="text-xs font-normal bg-slate-50 dark:bg-slate-800 pointer-events-none">
							OAuth
						</Badge>
					)}
				</div>
				<div className="flex-1 pointer-events-none">
					<h3 className="font-semibold text-base mb-1.5 line-clamp-1 text-slate-900 dark:text-slate-100">
						{displayName}
					</h3>
					{server.description && (
						<p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
							{server.description}
						</p>
					)}
				</div>
				{server.transport && server.transport.length > 0 && (
					<div className="flex flex-wrap gap-1.5 pt-2 pointer-events-none">
						{server.transport.slice(0, 3).map((transport) => (
							<Badge 
								key={transport} 
								variant="secondary" 
								className="text-xs font-normal bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 pointer-events-none"
							>
								{transport}
							</Badge>
						))}
					</div>
				)}
			</div>
		</Card>
	);
}

