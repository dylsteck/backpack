import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useChat } from "@ai-sdk/react";
import ChatInterface from "@/components/chat-interface";
import Loader from "@/components/loader";
import { Badge } from "@cortex/shared/components";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/chat")({
	component: ChatPage,
});

function ChatPage() {
	const { data: session, isPending } = authClient.useSession();
	const { data: userConnections } = trpc.mcp.getUserConnections.useQuery(undefined, {
		enabled: !!session?.user,
	});

	const { messages, isLoading, submit } = useChat({
		url: `${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}/api/chat`,
		onRequest: async ({ headers }) => {
			// Get the session token from auth client
			const sessionData = await authClient.getSession();
			if (sessionData?.data?.session?.token) {
				headers.set("Authorization", `Bearer ${sessionData.data.session.token}`);
			}
		},
	});

	// Custom send function
	const handleSend = (message: string) => {
		submit([
			{
				role: "user",
				content: message,
			},
		]);
	};

	if (isPending) {
		return <Loader />;
	}

	if (!session?.user) {
		return <Navigate to="/login" />;
	}

	const connectedCount = userConnections?.filter((c: any) => c.status === "connected").length || 0;

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-4xl font-bold mb-2">Chat</h1>
					<p className="text-slate-600 dark:text-slate-400">
						Powered by your connected MCP servers
					</p>
				</div>
				{connectedCount > 0 ? (
					<Badge variant="secondary" className="text-sm px-4 py-2">
						{connectedCount} MCP {connectedCount === 1 ? "server" : "servers"} active
					</Badge>
				) : (
					<Badge variant="outline" className="text-sm px-4 py-2">
						No MCP servers connected
					</Badge>
				)}
			</div>

			<ChatInterface
				messages={messages}
				onSend={handleSend}
				isLoading={isLoading}
			/>
		</div>
	);
}

