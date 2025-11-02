import React from "react";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster";
import { LinkPreview } from "./LinkPreview";

export function CastEntry({ cast }: { cast: FarcasterCastV2 }) {
	// Extract URLs from embeds that will be rendered as link previews
	const embedUrls = cast.embeds
		.filter((embed) => embed.metadata?.html)
		.map((embed) => embed.url);

	// Filter out embed URLs from the text and remove surrounding whitespace
	const filteredText = React.useMemo(() => {
		let text = cast.text;
		for (const url of embedUrls) {
			// Remove the URL and any whitespace around it
			// Match URL with optional whitespace before and after
			const urlRegex = new RegExp(`\\s*${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "g");
			text = text.replace(urlRegex, " ").trim();
		}
		// Clean up any double spaces or newlines that might remain
		return text.replace(/\s+/g, " ").trim();
	}, [cast.text, embedUrls]);

	const renderEmbed = (embed: FarcasterCastV2["embeds"][0]) => {
		if (embed.metadata?.html) {
			const og = embed.metadata.html;
			return (
				<LinkPreview
					image={og.ogImage?.[0]?.url || "/placeholder.svg"}
					title={og.ogTitle || ""}
					domain={new URL(embed.url).hostname}
					url={embed.url}
				/>
			);
		}
		return null;
	};

	return (
		<div className="space-y-2">
			<div className="flex items-start gap-3">
				<img
					src={cast.author.pfp_url}
					alt={cast.author.display_name}
					className="w-10 h-10 rounded-full shrink-0"
				/>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="text-sm font-medium">{cast.author.display_name}</span>
						<span className="text-xs text-muted-foreground">@{cast.author.username}</span>
					</div>
					<div className="text-sm whitespace-pre-wrap break-words">{filteredText}</div>
					{cast.embeds.length > 0 && (
						<div className="mt-3 space-y-2">
							{cast.embeds.map((embed, idx) => (
								<div key={idx}>{renderEmbed(embed)}</div>
							))}
						</div>
					)}
					<div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
						<span>{cast.reactions.likes_count} likes</span>
						<span>{cast.reactions.recasts_count} recasts</span>
						{cast.replies.count > 0 && <span>{cast.replies.count} replies</span>}
					</div>
				</div>
			</div>
		</div>
	);
}
