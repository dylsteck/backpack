import { useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Button,
	Label,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Badge,
} from "@cortex/shared/components";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

interface MCPSetupSheetProps {
	isOpen: boolean;
	onClose: () => void;
	server: {
		id: string;
		name: string;
		description?: string;
		vendor?: string;
	} | null;
}

export default function MCPSetupSheet({ isOpen, onClose, server }: MCPSetupSheetProps) {
	const [transportType, setTransportType] = useState<"stdio" | "http" | "sse">("http");
	const [command, setCommand] = useState("");
	const [args, setArgs] = useState("");
	const [url, setUrl] = useState("");
	const [headers, setHeaders] = useState("");

	const utils = trpc.useContext();
	const addConnection = trpc.mcp.addConnection.useMutation({
		onSuccess: () => {
			toast.success("MCP server connected successfully!");
			utils.mcp.getUserConnections.invalidate();
			handleClose();
		},
		onError: (error: any) => {
			toast.error(`Failed to connect: ${error.message}`);
		},
	});

	const handleClose = () => {
		setTransportType("http");
		setCommand("");
		setArgs("");
		setUrl("");
		setHeaders("");
		onClose();
	};

	const handleConnect = () => {
		if (!server) return;

		let transportConfig: any = {};

		if (transportType === "stdio") {
			if (!command) {
				toast.error("Command is required for stdio transport");
				return;
			}
			transportConfig = {
				command,
				args: args ? args.split(",").map((a) => a.trim()) : [],
			};
		} else {
			if (!url) {
				toast.error("URL is required for http/sse transport");
				return;
			}
			transportConfig = {
				url,
				headers: headers ? JSON.parse(headers) : undefined,
			};
		}

		addConnection.mutate({
			serverId: server.id,
			serverName: server.name,
			vendor: server.vendor,
			transportType,
			transportConfig,
		});
	};

	if (!server) return null;

	return (
		<Sheet open={isOpen} onOpenChange={handleClose}>
			<SheetContent className="overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Connect to {server.name}</SheetTitle>
					<SheetDescription>
						{server.description || "Configure the connection settings for this MCP server"}
					</SheetDescription>
				</SheetHeader>

				<div className="mt-6 space-y-6">
					{server.vendor && (
						<div>
							<Badge variant="secondary">{server.vendor}</Badge>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="transport-type">Transport Type</Label>
						<Select
							value={transportType}
							onValueChange={(value) => setTransportType(value as "stdio" | "http" | "sse")}
						>
							<SelectTrigger id="transport-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="http">HTTP</SelectItem>
								<SelectItem value="sse">Server-Sent Events (SSE)</SelectItem>
								<SelectItem value="stdio">STDIO (Local)</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							{transportType === "stdio" && "For local MCP servers running as processes"}
							{transportType === "http" && "For HTTP-based MCP servers"}
							{transportType === "sse" && "For Server-Sent Events MCP servers"}
						</p>
					</div>

					{transportType === "stdio" ? (
						<>
							<div className="space-y-2">
								<Label htmlFor="command">Command</Label>
								<Input
									id="command"
									placeholder="e.g., node or npx"
									value={command}
									onChange={(e) => setCommand(e.target.value)}
								/>
								<p className="text-xs text-muted-foreground">
									The command to execute the MCP server
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="args">Arguments (comma-separated)</Label>
								<Input
									id="args"
									placeholder="e.g., server.js, --port, 3000"
									value={args}
									onChange={(e) => setArgs(e.target.value)}
								/>
								<p className="text-xs text-muted-foreground">
									Optional arguments for the command
								</p>
							</div>
						</>
					) : (
						<>
							<div className="space-y-2">
								<Label htmlFor="url">URL</Label>
								<Input
									id="url"
									placeholder="e.g., http://localhost:3000/mcp"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
								/>
								<p className="text-xs text-muted-foreground">
									The URL endpoint of the MCP server
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="headers">Headers (JSON, optional)</Label>
								<Input
									id="headers"
									placeholder='{"Authorization": "Bearer token"}'
									value={headers}
									onChange={(e) => setHeaders(e.target.value)}
								/>
								<p className="text-xs text-muted-foreground">
									Optional HTTP headers as JSON
								</p>
							</div>
						</>
					)}

					<div className="flex gap-3 pt-4">
						<Button
							onClick={handleConnect}
							disabled={addConnection.isPending}
							className="flex-1"
						>
							{addConnection.isPending ? "Connecting..." : "Connect"}
						</Button>
						<Button variant="outline" onClick={handleClose}>
							Cancel
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}

