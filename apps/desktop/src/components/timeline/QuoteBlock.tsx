import type React from "react";

export function QuoteBlock({ children }: { children: React.ReactNode }) {
	return <div className="bg-muted rounded-lg p-4 text-sm space-y-2">{children}</div>;
}

