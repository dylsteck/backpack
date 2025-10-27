"use client";
import { Card } from "@cortex/shared/components";

const mockProjects = [
	{ id: 1, name: "#emerald", tag: "emerald", image: "", period: "now" },
	{ id: 2, name: "#silverbird", tag: "silverbird", image: "", period: "now" },
	{ id: 3, name: "#docs", tag: "docs", image: "", period: "now" },
	{ id: 4, name: "#global", tag: "global", image: "", period: "apr" },
	{ id: 5, name: "#SCA", tag: "SCA", image: "", period: "apr" },
	{ id: 6, name: "#solutions", tag: "solutions", image: "", period: "apr" },
	{ id: 7, name: "#research", tag: "research", image: "", period: "apr" },
	{ id: 8, name: "#posters", tag: "posters", image: "", period: "apr" },
];

export default function Home() {
	const nowProjects = mockProjects.filter((p) => p.period === "now");
	const aprProjects = mockProjects.filter((p) => p.period === "apr");

	return (
		<div>
			<h1 className="text-4xl font-light text-slate-400 dark:text-slate-500 mb-12">
				April 2019
			</h1>

			{/* NOW Section */}
			<div className="mb-16">
				<div className="flex items-center gap-4 mb-6">
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
						<span className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wider">
							NOW
						</span>
					</div>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{nowProjects.map((project) => (
						<Card
							key={project.id}
							className="aspect-4/3 bg-slate-100 dark:bg-slate-800 border-0 hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group"
						>
							<div className="w-full h-full flex items-center justify-center">
								<div className="text-center">
									<div className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
										{project.name}
									</div>
								</div>
							</div>
						</Card>
					))}
				</div>
			</div>

			{/* APR Section */}
			<div className="mb-16">
				<div className="flex items-center gap-4 mb-6">
					<span className="text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wider">
						APR
					</span>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{aprProjects.map((project) => (
						<Card
							key={project.id}
							className="aspect-4/3 bg-slate-100 dark:bg-slate-800 border-0 hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group"
						>
							<div className="w-full h-full flex items-center justify-center">
								<div className="text-center">
									<div className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
										{project.name}
									</div>
								</div>
							</div>
						</Card>
					))}
				</div>
			</div>

			{/* Additional months placeholders */}
			<div className="mb-16">
				<div className="flex items-center gap-4 mb-6">
					<span className="text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wider">
						MAR
					</span>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<Card className="aspect-4/3 bg-slate-100 dark:bg-slate-800 border-0 hover:shadow-lg transition-shadow cursor-pointer" />
					<Card className="aspect-4/3 bg-slate-100 dark:bg-slate-800 border-0 hover:shadow-lg transition-shadow cursor-pointer" />
				</div>
			</div>

			<div className="mb-16">
				<div className="flex items-center gap-4 mb-6">
					<span className="text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wider">
						FEB
					</span>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<Card className="aspect-4/3 bg-slate-100 dark:bg-slate-800 border-0 hover:shadow-lg transition-shadow cursor-pointer" />
					<Card className="aspect-4/3 bg-slate-100 dark:bg-slate-800 border-0 hover:shadow-lg transition-shadow cursor-pointer" />
					<Card className="aspect-4/3 bg-slate-100 dark:bg-slate-800 border-0 hover:shadow-lg transition-shadow cursor-pointer" />
				</div>
			</div>
		</div>
	);
}

