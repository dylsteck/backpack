import { useState } from "react";
import { Button, Input } from "@cortex/shared/components";
import { Send } from "lucide-react";

interface ChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
	const [input, setInput] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (input.trim() && !disabled) {
			onSend(input.trim());
			setInput("");
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="flex gap-2">
			<Input
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Type a message..."
				disabled={disabled}
				className="flex-1"
			/>
			<Button type="submit" disabled={disabled || !input.trim()} size="icon">
				<Send className="h-4 w-4" />
			</Button>
		</form>
	);
}

