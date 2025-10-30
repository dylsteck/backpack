import { Card } from "@cortex/ui/components";

interface AppCardProps {
	name: string;
	amount?: string;
	iconColor: string;
	iconText: string;
	isViewAll?: boolean;
	totalCount?: number;
}

export default function AppCard({
	name,
	amount,
	iconColor,
	iconText,
	isViewAll = false,
	totalCount,
}: AppCardProps) {
	return (
		<Card className="bg-slate-100 dark:bg-slate-800 border-0 p-6 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer rounded-xl">
			<div className="flex flex-col gap-4">
				<div
					className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-semibold text-white"
					style={{ backgroundColor: iconColor }}
				>
					{iconText}
				</div>
				<div>
					<h3 className="font-semibold text-lg mb-1">{name}</h3>
					{amount && (
						<p className="text-slate-600 dark:text-slate-400">{amount}</p>
					)}
					{isViewAll && totalCount && (
						<p className="text-slate-600 dark:text-slate-400">
							{totalCount} apps
						</p>
					)}
				</div>
			</div>
		</Card>
	);
}

