import type { FlyAnalytics } from "@backpack/sdk";
import {
	Line,
	LineChart,
	Pie,
	PieChart,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
	CartesianGrid,
} from "recharts";

const PIE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

export function AnalyticsPanel({ data }: { data: FlyAnalytics }) {
	const lineData = data.visitsByDay.map((d) => ({
		...d,
		label: d.date.length > 5 ? d.date.slice(5) : d.date,
	}));

	if (
		data.visitsByDay.length === 0 &&
		data.topDomains.length === 0 &&
		data.transitions.length === 0
	) {
		return (
			<p className="py-12 text-center text-sm text-muted-foreground">
				No analytics for this range yet. Browse in Fly to collect data.
			</p>
		);
	}

	return (
		<div className="space-y-8">
			{lineData.length > 0 ? (
				<div>
					<h3 className="mb-3 text-sm font-medium text-foreground">Visits per day</h3>
					<div className="h-[220px] w-full rounded-xl border border-border/60 bg-card/20 p-2 pr-4 pt-4">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={lineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
								<CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
								<XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
								<YAxis width={28} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
								<Tooltip
									contentStyle={{
										background: "hsl(var(--card))",
										border: "1px solid hsl(var(--border))",
										borderRadius: "8px",
										fontSize: "12px",
									}}
									labelFormatter={(_, payload) => {
										const row = Array.isArray(payload) ? payload[0]?.payload : undefined;
										const d =
											row && typeof row === "object" && row !== null && "date" in row
												? row.date
												: null;
										return d != null ? String(d) : "";
									}}
								/>
								<Line
									type="monotone"
									dataKey="count"
									stroke="var(--chart-1)"
									strokeWidth={2}
									dot={{ r: 2, fill: "var(--chart-1)" }}
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>
			) : null}

			<div className="grid gap-8 lg:grid-cols-2">
				{data.transitions.length > 0 ? (
					<div>
						<h3 className="mb-3 text-sm font-medium text-foreground">By transition</h3>
						<div className="h-[200px] w-full">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={data.transitions}
										dataKey="count"
										nameKey="transition"
										cx="50%"
										cy="50%"
										innerRadius={44}
										outerRadius={72}
										paddingAngle={2}
									>
										{data.transitions.map((_, i) => (
											<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
										))}
									</Pie>
									<Tooltip
										contentStyle={{
											background: "hsl(var(--card))",
											border: "1px solid hsl(var(--border))",
											borderRadius: "8px",
											fontSize: "12px",
										}}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>
					</div>
				) : null}

				{data.topDomains.length > 0 ? (
					<div>
						<h3 className="mb-3 text-sm font-medium text-foreground">Top domains</h3>
						<ul className="space-y-1.5 rounded-xl border border-border/60 bg-card/20 p-3 text-sm">
							{data.topDomains.map((d) => (
								<li key={d.domain} className="flex justify-between gap-2">
									<span className="min-w-0 truncate text-foreground">{d.domain}</span>
									<span className="shrink-0 tabular-nums text-muted-foreground">{d.count}</span>
								</li>
							))}
						</ul>
					</div>
				) : null}
			</div>
		</div>
	);
}
