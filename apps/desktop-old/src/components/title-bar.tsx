import CortexIcon from "./cortex-icon";

export default function TitleBar() {
	// On macOS, account for traffic lights (approximately 78px)
	const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
	const leftPadding = isMac ? '80px' : '16px';

	return (
		<div
			className="flex h-12 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/50"
			style={{
				WebkitAppRegion: "drag",
				appRegion: "drag",
				paddingLeft: leftPadding,
				paddingRight: "16px",
			}}
		>
			<div
				className="flex items-center gap-2 flex-1 min-w-0"
				style={{ WebkitAppRegion: "no-drag", appRegion: "no-drag" }}
			>
				<CortexIcon size={20} />
				<span className="text-sm font-medium text-foreground">Cortex</span>
			</div>
		</div>
	);
}

