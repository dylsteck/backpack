import { Card, Badge } from "@cortex/shared/components";

interface MCPServerCardProps {
	server: {
		id: string;
		name: string;
		description?: string;
		vendor?: string;
		categories?: string[];
		iconUrl?: string;
	};
	onClick?: () => void;
}

export default function MCPServerCard({ server, onClick }: MCPServerCardProps) {
	// Generate a color based on vendor or server name
	const getIconColor = (text: string) => {
		const colors = [
			"#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", 
			"#10b981", "#06b6d4", "#6366f1", "#f43f5e"
		];
		const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return colors[hash % colors.length];
	};

	const iconColor = getIconColor(server.vendor || server.name);
	const iconText = (server.vendor || server.name).charAt(0).toUpperCase();

	return (
		<Card 
			className="bg-slate-100 dark:bg-slate-800 border-0 p-6 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer rounded-xl"
			onClick={onClick}
		>
			<div className="flex flex-col gap-4">
				<div className="flex items-start justify-between">
					<div
						className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-semibold text-white shrink-0"
						style={{ backgroundColor: iconColor }}
					>
						{iconText}
					</div>
					{server.vendor && (
						<Badge variant="secondary" className="text-xs">
							{server.vendor}
						</Badge>
					)}
				</div>
				<div>
					<h3 className="font-semibold text-base mb-1 line-clamp-1">
						{server.name}
					</h3>
					{server.description && (
						<p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
							{server.description}
						</p>
					)}
				</div>
				{server.categories && server.categories.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{server.categories.slice(0, 3).map((category) => (
							<Badge 
								key={category} 
								variant="outline" 
								className="text-xs"
							>
								{category}
							</Badge>
						))}
					</div>
				)}
			</div>
		</Card>
	);
}

