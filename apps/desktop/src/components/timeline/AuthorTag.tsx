export function AuthorTag({ name, time }: { name: string; time: string }) {
	return (
		<div className="flex items-center gap-2 mt-2">
			<div className="w-4 h-4 rounded-full bg-blue-400" />
			<span className="text-xs text-muted-foreground">{name}</span>
			<span className="text-xs text-muted-foreground">·</span>
			<span className="text-xs text-muted-foreground">{time}</span>
		</div>
	);
}

