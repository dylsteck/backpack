import React from "react";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster/types";
import { LinkPreview } from "./LinkPreview";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CastExpandedView({ 
	cast, 
	onClose 
}: { 
	cast: FarcasterCastV2; 
	onClose: () => void;
}) {
	// Helper function to get image from embed
	function getImageFromEmbed(embed: FarcasterCastV2["embeds"][0]): string | null {
		if (!embed.metadata?.html) return null;
		
		const og = embed.metadata.html;
		const url = embed.url.toLowerCase();
		
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
		
		if (validImages && validImages.length > 0) {
			return validImages[0].url;
		}
		
		if ((url.includes('twitter.com') || url.includes('x.com')) && (og as any).oembed) {
			const oembed = (og as any).oembed;
			if (oembed.html) {
				const picMatch = oembed.html.match(/pic\.twitter\.com\/([a-zA-Z0-9]+)/);
				if (picMatch) {
					return `https://pbs.twimg.com/media/${picMatch[1]}`;
				}
				
				const mediaUrlMatch = oembed.html.match(/pbs\.twimg\.com\/media\/([a-zA-Z0-9_-]+)/);
				if (mediaUrlMatch) {
					return `https://pbs.twimg.com/media/${mediaUrlMatch[1]}`;
				}
			}
			
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
		
		return null;
	}

	const embedsWithImages = React.useMemo(() => {
		return cast.embeds.map((embed: FarcasterCastV2["embeds"][0]) => ({
			embed,
			imageUrl: getImageFromEmbed(embed),
		}));
	}, [cast.embeds]);

	const renderEmbed = (embed: FarcasterCastV2["embeds"][0]) => {
		if (!embed.metadata?.html) return null;
		
		const og = embed.metadata.html;
		const imageUrl = getImageFromEmbed(embed);
		
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
		<div className="mt-3 pt-3 border-t border-border/50 space-y-3">
			<div className="flex items-center justify-between">
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-6 w-6 -ml-2"
				>
					<X className="h-3 w-3" />
				</Button>
			</div>
			
			{cast.text && cast.text.trim() && (
				<div className="space-y-1.5">
					<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Complete Text</div>
					<div className="text-sm whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
						{cast.text}
					</div>
				</div>
			)}

			{cast.embeds.length > 0 && (
				<div className="space-y-2">
					<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Links</div>
					<div className="space-y-2">
						{cast.embeds.map((embed: FarcasterCastV2["embeds"][0], idx: number) => {
							const rendered = renderEmbed(embed);
							return rendered ? <div key={idx}>{rendered}</div> : null;
						})}
					</div>
				</div>
			)}

			<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
				{cast.channel && (
					<div className="flex items-center gap-1.5">
						{cast.channel.image_url && (
							<img
								src={cast.channel.image_url}
								alt={cast.channel.name}
								className="w-3.5 h-3.5 rounded-full"
							/>
						)}
						<span>{cast.channel.name}</span>
					</div>
				)}
				{(cast.channel || cast.reactions.likes_count > 0 || cast.reactions.recasts_count > 0 || cast.replies.count > 0) && (
					<span>•</span>
				)}
				{cast.reactions.likes_count > 0 && <span>{cast.reactions.likes_count} likes</span>}
				{cast.reactions.recasts_count > 0 && <span>{cast.reactions.recasts_count} recasts</span>}
				{cast.replies.count > 0 && <span>{cast.replies.count} replies</span>}
				<span>•</span>
				<span>{new Date(cast.timestamp).toLocaleString()}</span>
			</div>
		</div>
	);
}

