import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import AppCard from "@/components/app-card";
import { Button } from "@cortex/shared/components";

const mockAppsData = [
	{ name: "Notion", amount: "$2,450.50", iconColor: "#000000", iconText: "N" },
	{ name: "Figma", amount: "$1,890.25", iconColor: "#f24e1e", iconText: "F" },
	{ name: "Slack", amount: "$1,234.00", iconColor: "#4a154b", iconText: "S" },
	{ name: "Linear", amount: "$987.60", iconColor: "#5e6ad2", iconText: "L" },
	{ name: "GitHub", amount: "$856.40", iconColor: "#24292e", iconText: "G" },
	{ name: "Vercel", amount: "$745.30", iconColor: "#000000", iconText: "▲" },
	{ name: "Discord", amount: "$623.15", iconColor: "#5865f2", iconText: "D" },
];

export const Route = createFileRoute("/items")({
	component: ItemsPage,
});

function ItemsPage() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-center">
					<p className="text-2xl text-slate-400 dark:text-slate-500">Loading...</p>
				</div>
			</div>
		)
	}

	if (!session?.user) {
		return <Navigate to="/login" />;
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-4xl font-bold">Your items (101)</h1>
				<Button variant="outline" className="rounded-full px-6">
					View more →
				</Button>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{mockAppsData.map((item) => (
					<AppCard
						key={item.name}
						name={item.name}
						amount={item.amount}
						iconColor={item.iconColor}
						iconText={item.iconText}
					/>
				))}
				<AppCard
					name="View all"
					iconColor="#ffffff"
					iconText="→"
					isViewAll
					totalCount={101}
				/>
			</div>
		</div>
	)
}

