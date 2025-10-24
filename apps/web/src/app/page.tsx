"use client";
import AppCard from "@/components/app-card";
import { Button } from "@/components/ui/button";

const mockActivityData = [
	{ name: "Farcaster wallet", amount: "$1,316.02", iconColor: "#7c3aed", iconText: "F" },
	{ name: "Dot", amount: "$129.02", iconColor: "#f59e0b", iconText: "D" },
	{ name: "draw.tech", amount: "$90.95", iconColor: "#a855f7", iconText: "D" },
	{ name: "Clip", amount: "$86.97", iconColor: "#c084fc", iconText: "+" },
	{ name: "Frenpet", amount: "$62.93", iconColor: "#d8b4fe", iconText: "F" },
	{ name: "Rodeo", amount: "$59.36", iconColor: "#1e293b", iconText: "✱" },
	{ name: "Fantasy", amount: "$57.34", iconColor: "#16a34a", iconText: "ƒ" },
];

export default function Home() {
	return (
		<div className="container mx-auto px-8 py-8">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-4xl font-bold">Activity (101)</h1>
				<Button variant="outline" className="rounded-full px-6">
					View more →
				</Button>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{mockActivityData.map((item) => (
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
