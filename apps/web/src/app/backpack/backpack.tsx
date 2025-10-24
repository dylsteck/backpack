"use client";
import AppCard from "@/components/app-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const mockBackpackData = [
	{ name: "ChatGPT", amount: "$3,200.75", iconColor: "#10a37f", iconText: "G" },
	{ name: "Claude", amount: "$2,890.40", iconColor: "#d97757", iconText: "C" },
	{ name: "Midjourney", amount: "$1,567.20", iconColor: "#000000", iconText: "M" },
	{ name: "Cursor", amount: "$1,234.90", iconColor: "#0066ff", iconText: "C" },
	{ name: "Raycast", amount: "$987.50", iconColor: "#ff6363", iconText: "R" },
	{ name: "Arc Browser", amount: "$845.30", iconColor: "#fcbfbd", iconText: "A" },
	{ name: "Loom", amount: "$756.80", iconColor: "#625df5", iconText: "L" },
];

export default function Backpack({
	session,
}: {
	session: typeof authClient.$Infer.Session;
}) {
	return (
		<div className="container mx-auto px-8 py-8">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-4xl font-bold">Your backpack (101)</h1>
				<Button variant="outline" className="rounded-full px-6">
					View more →
				</Button>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{mockBackpackData.map((item) => (
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
	);
}
