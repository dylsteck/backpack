import type React from "react";

export function LinkPreview({
	image,
	title,
	domain,
	url,
}: {
	image: string;
	title: string;
	domain: string;
	url: string;
}) {
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="block bg-muted rounded-xl overflow-hidden hover:bg-muted/80 transition-colors"
		>
			<div className="relative w-full h-48">
				<img src={image || "/placeholder.svg"} alt={title} className="absolute inset-0 w-full h-full object-cover" />
			</div>
			<div className="p-4">
				<h3 className="font-medium text-sm mb-1">{title}</h3>
				<p className="text-xs text-muted-foreground">{domain}</p>
			</div>
		</a>
	);
}

