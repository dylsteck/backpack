export function DateSeparator({ date }: { date: string }) {
	return (
		<div className="relative flex items-center gap-4 my-4 -mx-3 z-10">
			<div className="absolute left-0 right-0 h-px bg-red-500" />
			<div className="relative px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full z-10">{date}</div>
		</div>
	);
}

