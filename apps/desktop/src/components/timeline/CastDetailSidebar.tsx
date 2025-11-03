import React from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster/types";

export function CastDetailSidebar({
	open,
	onOpenChange,
	cast,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	cast: FarcasterCastV2 | null;
}) {
	if (!cast) return null;

	return (
		<Sidebar
			side="right"
			variant="sidebar"
			collapsible="offcanvas"
			className="z-50"
		>
			<SidebarHeader className="p-4 border-b">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold">Cast Details</h2>
						<p className="text-sm text-muted-foreground">
							Posted on {new Date(cast.timestamp).toLocaleString()}
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => onOpenChange(false)}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</SidebarHeader>
			<SidebarContent className="p-4 overflow-y-auto">
					<div className="space-y-4">
						<div className="flex items-start gap-3">
							<img
								src={cast.author.pfp_url}
								alt={cast.author.display_name}
								className="w-12 h-12 rounded-full shrink-0"
							/>
							<div className="flex-1 min-w-0">
								<div className="text-sm font-medium">{cast.author.display_name}</div>
								<div className="text-xs text-muted-foreground">@{cast.author.username}</div>
								{cast.author.profile?.bio?.text && (
									<div className="text-xs text-muted-foreground mt-1">
										{cast.author.profile.bio.text}
									</div>
								)}
							</div>
						</div>
						<Separator />
						<div className="space-y-2">
							<div className="text-sm font-medium">Content</div>
							<div className="text-sm text-muted-foreground whitespace-pre-wrap">
								{cast.text}
							</div>
						</div>
						<Separator />
						<div className="space-y-2">
							<div className="text-sm font-medium">Hash</div>
							<div className="text-sm text-muted-foreground font-mono break-all">
								{cast.hash}
							</div>
						</div>
						<Separator />
						<div className="space-y-2">
							<div className="text-sm font-medium">Engagement</div>
							<div className="flex items-center gap-4 text-sm text-muted-foreground">
								<span>{cast.reactions.likes_count} likes</span>
								<span>{cast.reactions.recasts_count} recasts</span>
								{cast.replies.count > 0 && <span>{cast.replies.count} replies</span>}
							</div>
						</div>
						{cast.embeds.length > 0 && (
							<>
								<Separator />
								<div className="space-y-2">
									<div className="text-sm font-medium">Embeds ({cast.embeds.length})</div>
									<div className="space-y-3">
										{cast.embeds.map((embed, idx) => (
											<div key={idx} className="space-y-1">
												<a
													href={embed.url}
													target="_blank"
													rel="noopener noreferrer"
													className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
												>
													{embed.url}
												</a>
												{embed.metadata?.html && (
													<div className="text-xs text-muted-foreground">
														{embed.metadata.html.ogTitle || embed.metadata.html.ogDescription || "No preview available"}
													</div>
												)}
												{idx < cast.embeds.length - 1 && <Separator />}
											</div>
										))}
									</div>
								</div>
							</>
						)}
						{cast.channel && (
							<>
								<Separator />
								<div className="space-y-2">
									<div className="text-sm font-medium">Channel</div>
									<div className="flex items-center gap-2">
										{cast.channel.image_url && (
											<img
												src={cast.channel.image_url}
												alt={cast.channel.name}
												className="w-6 h-6 rounded-full"
											/>
										)}
										<span className="text-sm text-muted-foreground">{cast.channel.name}</span>
									</div>
								</div>
							</>
						)}
						{cast.author.follower_count > 0 && (
							<>
								<Separator />
								<div className="space-y-2">
									<div className="text-sm font-medium">Author Stats</div>
									<div className="text-sm text-muted-foreground">
										{cast.author.follower_count.toLocaleString()} followers • {cast.author.following_count.toLocaleString()} following
									</div>
								</div>
							</>
						)}
						{cast.author.verified_addresses.eth_addresses.length > 0 && (
							<>
								<Separator />
								<div className="space-y-2">
									<div className="text-sm font-medium">Verified Addresses</div>
									<div className="space-y-1">
										{cast.author.verified_addresses.eth_addresses.map((addr, idx) => (
											<div key={idx} className="text-xs text-muted-foreground font-mono break-all">
												ETH: {addr}
											</div>
										))}
										{cast.author.verified_addresses.sol_addresses.map((addr, idx) => (
											<div key={idx} className="text-xs text-muted-foreground font-mono break-all">
												SOL: {addr}
											</div>
										))}
									</div>
								</div>
							</>
						)}
						<Separator />
						<div className="space-y-2">
							<div className="text-sm font-medium">Timestamp</div>
							<div className="text-sm text-muted-foreground">
								{new Date(cast.timestamp).toLocaleString()}
							</div>
						</div>
					</div>
				</SidebarContent>
			</Sidebar>
		);
}

