import { useEffect, useRef } from "react";
import { ScrollArea } from "@cortex/ui/components";
import ChatMessage from "./chat-message";
import ChatInput from "./chat-input";
import type { UIMessage } from "@ai-sdk/react";

interface ChatInterfaceProps {
	messages: UIMessage[];
	onSend: (message: string) => void;
	isLoading?: boolean;
}

export default function ChatInterface({ messages, onSend, isLoading }: ChatInterfaceProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (scrollRef.current) {
			const scrollElement = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
			if (scrollElement) {
				scrollElement.scrollTop = scrollElement.scrollHeight;
			}
		}
	}, [messages]);

	return (
		<div className="flex flex-col h-[calc(100vh-12rem)]">
			<ScrollArea ref={scrollRef} className="flex-1 pr-4">
				<div className="space-y-4 pb-4">
					{messages.length === 0 ? (
						<div className="flex items-center justify-center h-full min-h-[40vh]">
							<div className="text-center">
								<h3 className="text-xl font-semibold mb-2">Start a conversation</h3>
								<p className="text-sm text-slate-600 dark:text-slate-400">
									Your connected MCP servers are ready to help
								</p>
							</div>
						</div>
					) : (
						messages.map((message) => {
							// Extract text content from UIMessage
							let textContent = "";
							if (typeof message.content === "string") {
								textContent = message.content;
							} else if (Array.isArray(message.content)) {
								textContent = message.content
									.filter((part: any) => part.type === "text")
									.map((part: any) => part.text)
									.join(" ");
							}
							
							return (
								<ChatMessage
									key={message.id}
									role={message.role}
									content={textContent}
								/>
							);
						})
					)}
					{isLoading && (
						<div className="flex gap-4">
							<div className="h-8 w-8 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center shrink-0">
								<div className="h-2 w-2 rounded-full bg-white animate-pulse" />
							</div>
							<div className="flex-1 rounded-lg p-4 bg-slate-100 dark:bg-slate-800">
								<div className="flex gap-1">
									<div className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
									<div className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
									<div className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
								</div>
							</div>
						</div>
					)}
				</div>
			</ScrollArea>
			<div className="pt-4 border-t">
				<ChatInput onSend={onSend} disabled={isLoading} />
			</div>
		</div>
	);
}

