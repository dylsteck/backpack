export function DateSeparator({ date }: { date: string }) {
	return (
		<div className="flex items-center gap-4 my-4">
			<div className="flex-1 h-px bg-red-500" />
			<div className="px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full">{date}</div>
		</div>
	);
}

