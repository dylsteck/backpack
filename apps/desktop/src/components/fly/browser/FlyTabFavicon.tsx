import { useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { googleHostedFaviconUrl } from "./fly-browser-helpers";

export function FlyTabFavicon({
	pageUrl,
	preferredSrc,
	className,
}: {
	pageUrl: string;
	preferredSrc: string | undefined;
	className: string;
}) {
	const hosted = googleHostedFaviconUrl(pageUrl);
	const candidates = [...new Set([preferredSrc, hosted].filter(Boolean))] as string[];
	const [failIndex, setFailIndex] = useState(0);

	if (failIndex >= candidates.length) {
		return <Globe className={cn(className, "shrink-0 text-muted-foreground")} />;
	}

	return (
		<img
			src={candidates[failIndex]}
			alt=""
			referrerPolicy="no-referrer"
			className={cn(className, "shrink-0 rounded-sm object-contain")}
			onError={() => setFailIndex((i) => i + 1)}
		/>
	);
}
