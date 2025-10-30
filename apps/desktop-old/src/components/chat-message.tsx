import { Avatar } from "@cortex/ui/components";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
	role: "user" | "assistant";
	content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
	const isUser = role === "user";

	return (
		<div className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
			<Avatar className="h-8 w-8 shrink-0">
				{isUser ? (
					<div className="flex h-full w-full items-center justify-center bg-primary">
						<User className="h-4 w-4 text-primary-foreground" />
					</div>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-slate-700 dark:bg-slate-600">
						<Bot className="h-4 w-4 text-white" />
					</div>
				)}
			</Avatar>
			<div
				className={`flex-1 rounded-lg p-4 ${
					isUser
						? "bg-primary text-primary-foreground"
						: "bg-slate-100 dark:bg-slate-800"
				}`}
			>
				<div className="prose prose-sm dark:prose-invert max-w-none">
					<p className="whitespace-pre-wrap m-0">{content}</p>
				</div>
			</div>
		</div>
	);
}

