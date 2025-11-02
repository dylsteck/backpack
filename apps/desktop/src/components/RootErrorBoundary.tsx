import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ErrorComponentProps } from "@tanstack/react-router";

export function RootErrorBoundary({ error, reset }: ErrorComponentProps) {
	return (
		<div className="flex h-screen w-full items-center justify-center bg-background p-4">
			<div className="max-w-lg w-full space-y-4">
				<div className="flex items-center gap-3">
					<AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
					<h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
				</div>
				<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
					<p className="text-sm font-mono text-destructive mb-2 break-all">{error.message || "An unexpected error occurred"}</p>
					{error.stack && (
						<details className="mt-3">
							<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
								Stack trace
							</summary>
							<pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap">
								{error.stack}
							</pre>
						</details>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button onClick={reset} variant="default" className="flex items-center gap-2">
						<RefreshCw className="h-4 w-4" />
						Try again
					</Button>
					<Button onClick={() => window.location.reload()} variant="outline">
						Reload page
					</Button>
				</div>
			</div>
		</div>
	);
}

