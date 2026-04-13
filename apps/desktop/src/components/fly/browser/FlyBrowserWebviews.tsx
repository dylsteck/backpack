import { cn } from "@/lib/utils";
import type { FlyBrowserTab } from "./fly-browser-types";

type Props = {
	tabs: FlyBrowserTab[];
	activeTabId: string;
	viewMode: "browser" | "grid";
	makeWebviewRef: (tabId: string) => (node: WebviewHTMLElement | null) => void;
};

export function FlyBrowserWebviews({ tabs, activeTabId, viewMode, makeWebviewRef }: Props) {
	return (
		<div
			className={cn(
				"absolute inset-0",
				viewMode === "grid" && "z-0 opacity-0 [&_webview]:pointer-events-none",
			)}
			aria-hidden={viewMode === "grid"}
		>
			{tabs.map((tab) => (
				<webview
					key={tab.id}
					src={tab.url}
					ref={makeWebviewRef(tab.id)}
					// @ts-expect-error Electron webview boolean attribute
					allowpopups="true"
					className={cn(
						"absolute inset-0 h-full w-full",
						tab.id !== activeTabId && "invisible",
					)}
				/>
			))}
		</div>
	);
}
