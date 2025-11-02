import type React from "react";

export function TimelineEntry({
	time,
	date,
	children,
	showDot,
	iconUrl,
	showLine = false,
}: {
	time: string;
	date?: string;
	children: React.ReactNode;
	showDot?: boolean;
	iconUrl?: string;
	showLine?: boolean;
}) {
	return (
		<div className="relative flex gap-4">
			<div className="flex flex-col items-center">
				{showDot && (
					<>
						{iconUrl ? (
							<div className="w-[19px] h-[19px] rounded-full bg-muted flex items-center justify-center mt-1 p-0.5">
								<img
									src={iconUrl}
									alt=""
									className="w-full h-full rounded-full object-cover"
								/>
							</div>
						) : (
							<div className="w-3 h-3 rounded-full bg-gray-300 mt-1" />
						)}
						{showLine && <div className="w-0.5 h-full bg-gray-300 mt-1" />}
					</>
				)}
			</div>
			<div className="flex-1 min-w-0">{children}</div>
			<div className="text-xs text-muted-foreground whitespace-nowrap">
				<div>{time}</div>
				{date && <div>{date}</div>}
			</div>
		</div>
	);
}

