import React from "react";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster/types";
import { LinkPreview } from "./LinkPreview";

export function CastEntry({ cast }: { cast: FarcasterCastV2 }) {
	// Helper function to get image from embed
	function getImageFromEmbed(embed: FarcasterCastV2["embeds"][0]): string | null {
		if (!embed.metadata?.html) return null;
		
		const og = embed.metadata.html;
		const url = embed.url.toLowerCase();
		
		// Filter out SVG and emoji images (they're not real preview images)
		const validImages = og.ogImage?.filter(
			(img: { url: string }) => {
				const imgUrl = img.url?.toLowerCase() || '';
				return imgUrl && 
					!imgUrl.endsWith('.svg') && 
					!imgUrl.includes('emoji') && 
					!imgUrl.includes('twimg.com/emoji') &&
					!imgUrl.includes('abs-0.twimg.com/emoji');
			}
		);
		
		// Prefer non-SVG images
		if (validImages && validImages.length > 0) {
			return validImages[0].url;
		}
		
		// For Twitter/X links, try to extract media ID from oembed HTML
		if ((url.includes('twitter.com') || url.includes('x.com')) && (og as any).oembed) {
			const oembed = (og as any).oembed;
			if (oembed.html) {
				// Look for pic.twitter.com URLs which contain media IDs
				const picMatch = oembed.html.match(/pic\.twitter\.com\/([a-zA-Z0-9]+)/);
				if (picMatch) {
					const mediaId = picMatch[1];
					// Construct Twitter media URL format: https://pbs.twimg.com/media/{id}
					return `https://pbs.twimg.com/media/${mediaId}`;
				}
				
				// Also check for direct pbs.twimg.com media URLs in the HTML
				const mediaUrlMatch = oembed.html.match(/pbs\.twimg\.com\/media\/([a-zA-Z0-9_-]+)/);
				if (mediaUrlMatch) {
					return `https://pbs.twimg.com/media/${mediaUrlMatch[1]}`;
				}
			}
			
			// Also check ogImage URLs for pbs.twimg.com media IDs
			if (og.ogImage && og.ogImage.length > 0) {
				for (const img of og.ogImage) {
					if (img.url) {
						const mediaMatch = img.url.match(/pbs\.twimg\.com\/media\/([a-zA-Z0-9_-]+)/);
						if (mediaMatch) {
							return `https://pbs.twimg.com/media/${mediaMatch[1]}`;
						}
					}
				}
			}
		}
		
		// Check for video thumbnails
		if (embed.metadata.video) {
			// Video embeds might have thumbnails in the future
		}
		
		return null;
	}

	// Get image for each embed to determine which ones will render as LinkPreview
	const embedsWithImages = React.useMemo(() => {
		return cast.embeds.map((embed: FarcasterCastV2["embeds"][0]) => ({
			embed,
			imageUrl: getImageFromEmbed(embed),
		}));
	}, [cast.embeds]);

	// Only filter out URLs that will be rendered as LinkPreviews (those with images)
	const embedUrlsForPreviews = React.useMemo(() => {
		return embedsWithImages
			.filter(({ imageUrl }) => imageUrl !== null)
			.map(({ embed }) => embed.url);
	}, [embedsWithImages]);

	// Filter out only the URLs that will be rendered as LinkPreviews
	const filteredText = React.useMemo(() => {
		let text = cast.text;
		for (const url of embedUrlsForPreviews) {
			// Remove the URL and any whitespace around it
			// Match URL with optional whitespace before and after
			const urlRegex = new RegExp(`\\s*${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "g");
			text = text.replace(urlRegex, " ").trim();
		}
		// Clean up any double spaces or newlines that might remain
		return text.replace(/\s+/g, " ").trim();
	}, [cast.text, embedUrlsForPreviews]);

	// Function to render text with linkified URLs
	const renderTextWithLinks = (text: string) => {
		// URL regex pattern
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const parts = text.split(urlRegex);
		
		return parts.map((part, index) => {
			if (urlRegex.test(part)) {
				return (
					<a
						key={index}
						href={part}
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-500 hover:underline break-all"
					>
						{part}
					</a>
				);
			}
			return <React.Fragment key={index}>{part}</React.Fragment>;
		});
	};

	const renderEmbed = (embed: FarcasterCastV2["embeds"][0]) => {
		if (!embed.metadata?.html) return null;
		
		const og = embed.metadata.html;
		const imageUrl = getImageFromEmbed(embed);
		
		// Only render LinkPreview if there's an image
		if (!imageUrl) return null;
		
		return (
			<LinkPreview
				image={imageUrl}
				title={og.ogTitle || ""}
				domain={new URL(embed.url).hostname}
				url={embed.url}
			/>
		);
	};

	return (
		<div className="space-y-2">
			<div className="flex items-start gap-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="text-sm font-medium">{cast.author.display_name}</span>
						<span className="text-xs text-muted-foreground">@{cast.author.username}</span>
					</div>
					<div className="text-sm whitespace-pre-wrap wrap-break-word">
						{renderTextWithLinks(filteredText)}
					</div>
					{cast.embeds.length > 0 && (
						<div className="mt-3 space-y-2">
							{cast.embeds.map((embed: FarcasterCastV2["embeds"][0], idx: number) => {
								const rendered = renderEmbed(embed);
								return rendered ? <div key={idx}>{rendered}</div> : null;
							})}
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
