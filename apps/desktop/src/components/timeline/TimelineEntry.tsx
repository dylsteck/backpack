import React from "react";

export const TimelineEntry = React.memo(function TimelineEntry({
	time,
	date,
	children,
	showDot,
	iconUrl,
	showLine = true,
	isExpanded = false,
	expandedContent,
}: {
	time: string;
	date?: string;
	children: React.ReactNode;
	showDot?: boolean;
	iconUrl?: string;
	showLine?: boolean;
	isExpanded?: boolean;
	expandedContent?: React.ReactNode;
}) {
	return (
		<div className="relative flex gap-4 z-10">
			<div className="flex flex-col items-center w-[19px] relative">
				{showDot && (
					<div className="relative">
						{iconUrl ? (
							<div className="w-[19px] h-[19px] rounded-full bg-muted flex items-center justify-center mt-1 p-0.5 shrink-0">
								<img
									src={iconUrl}
									alt=""
									className="w-full h-full rounded-full object-cover"
								/>
							</div>
						) : (
							<div className="w-3 h-3 rounded-full bg-gray-300 mt-1 shrink-0" />
						)}
					</div>
				)}
			</div>
			<div className="flex-1 min-w-0">
				<div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'bg-muted/30 rounded-lg p-3 -m-3' : ''}`}>
					{children}
					{isExpanded && expandedContent && (
						<div 
							className="mt-3"
						>
							{expandedContent}
						</div>
					)}
				</div>
			</div>
			<div className="text-xs text-muted-foreground whitespace-nowrap">
				<div>{time}</div>
			</div>
		</div>
	);
});

