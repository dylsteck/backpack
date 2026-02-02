/**
 * Interactive dashboard TUI using OpenTUI
 * Shows Cortex status, connections, and data summary
 */

interface ConnectionStatus {
	id: string;
	name: string;
	status: "connected" | "disconnected" | "error";
	lastSyncedAt?: Date | null;
}

interface DataSummary {
	source: string;
	type: string;
	count: number;
}

interface DashboardData {
	connections: ConnectionStatus[];
	dataSummary: DataSummary[];
	totalItems: number;
}

/**
 * Run interactive dashboard TUI
 */
export async function runDashboardTUI(data: DashboardData): Promise<void> {
	try {
		const {
			createCliRenderer,
			BoxRenderable,
			TextRenderable,
			t,
			fg,
			bold,
			dim,
		} = await import("@opentui/core");

		const renderer = await createCliRenderer({
			exitOnCtrlC: true,
		});

		renderer.setBackgroundColor("#0f172a");

		// Main container with flex layout
		const container = new BoxRenderable(renderer, {
			id: "dashboard-container",
			flexDirection: "column",
			width: "100%",
			height: "100%",
			padding: 1,
		});
		renderer.root.add(container);

		// Header
		const header = new TextRenderable(renderer, {
			id: "dashboard-header",
			content: t`${bold(fg("#60a5fa")("📊 Cortex Dashboard"))}`,
			height: 2,
			flexShrink: 0,
		});
		container.add(header);

		// Connections section
		const connectionsHeader = new TextRenderable(renderer, {
			id: "connections-header",
			content: t`${bold(fg("#ffffff")("Connections"))}`,
			height: 1,
			flexShrink: 0,
			marginTop: 1,
		});
		container.add(connectionsHeader);

		// Connection list
		const connectionLines = data.connections.map((conn) => {
			const statusIcon = conn.status === "connected" ? "●" : "○";
			const statusColor = conn.status === "connected" ? "#22c55e" : "#ef4444";
			const syncInfo = conn.lastSyncedAt
				? ` (synced ${formatRelativeTime(conn.lastSyncedAt)})`
				: "";
			return t`  ${fg(statusColor)(statusIcon)} ${conn.name}${dim(fg("#64748b")(syncInfo))}`;
		});

		if (connectionLines.length === 0) {
			connectionLines.push(t`  ${dim(fg("#64748b")("No connections configured"))}`);
		}

		const connectionsList = new TextRenderable(renderer, {
			id: "connections-list",
			content: connectionLines.join("\n"),
			height: Math.min(connectionLines.length, 10),
			flexShrink: 0,
		});
		container.add(connectionsList);

		// Data summary section
		const dataHeader = new TextRenderable(renderer, {
			id: "data-header",
			content: t`${bold(fg("#ffffff")("Data Summary"))} ${dim(fg("#64748b")(`(${data.totalItems} total items)`))}`,
			height: 1,
			flexShrink: 0,
			marginTop: 2,
		});
		container.add(dataHeader);

		// Group by source
		const bySource: Record<string, DataSummary[]> = {};
		for (const item of data.dataSummary) {
			if (!bySource[item.source]) {
				bySource[item.source] = [];
			}
			bySource[item.source].push(item);
		}

		const dataLines: string[] = [];
		for (const [source, items] of Object.entries(bySource)) {
			const sourceTotal = items.reduce((acc, i) => acc + i.count, 0);
			const sourceColor = getSourceColor(source);
			dataLines.push(t`  ${fg(sourceColor)(source)}: ${sourceTotal} items`);
			for (const item of items) {
				dataLines.push(t`    ${dim(fg("#64748b")(`- ${item.type}: ${item.count}`))}`);
			}
		}

		if (dataLines.length === 0) {
			dataLines.push(t`  ${dim(fg("#64748b")("No data yet"))}`);
		}

		const dataList = new TextRenderable(renderer, {
			id: "data-list",
			content: dataLines.join("\n"),
			flexGrow: 1,
		});
		container.add(dataList);

		// Footer
		const footer = new TextRenderable(renderer, {
			id: "dashboard-footer",
			content: t`${dim(fg("#64748b")("Press q or Esc to exit"))}`,
			height: 1,
			flexShrink: 0,
			marginTop: 1,
		});
		container.add(footer);

		// Handle exit
		renderer.keyInput.on("keypress", (key: { name: string }) => {
			if (key.name === "escape" || key.name === "q") {
				renderer.destroy();
			}
		});

		renderer.start();
	} catch (error) {
		console.error("Dashboard mode requires OpenTUI. Install with: bun add @opentui/core");
		console.error("Note: OpenTUI requires Zig to be installed on your system.");
	}
}

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diff = now.getTime() - date.getTime();

	if (diff < 60 * 1000) return "just now";
	if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
	if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
	return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ago`;
}

function getSourceColor(source: string): string {
	const colors: Record<string, string> = {
		farcaster: "#8b5cf6",
		teller: "#22c55e",
		obsidian: "#3b82f6",
		chrome: "#facc15",
		brave: "#ef4444",
		user: "#06b6d4",
	};
	return colors[source] || "#ffffff";
}
