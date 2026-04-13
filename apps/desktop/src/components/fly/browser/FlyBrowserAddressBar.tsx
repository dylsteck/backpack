import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";

type Props = {
	value: string;
	placeholder: string;
	onChange: (v: string) => void;
	onFocus: () => void;
	onBlur: () => void;
	onSubmit: (e: React.FormEvent) => void;
	onBack: () => void;
	onForward: () => void;
	onReload: () => void;
	canGoBack: boolean;
	canGoForward: boolean;
};

export function FlyBrowserAddressBar({
	value,
	placeholder,
	onChange,
	onFocus,
	onBlur,
	onSubmit,
	onBack,
	onForward,
	onReload,
	canGoBack,
	canGoForward,
}: Props) {
	return (
		<div className="flex items-center gap-1.5 px-1.5 py-1 shadow-[0_1px_0_0_hsl(var(--border)/0.5)] md:px-2">
			<div className="flex items-center gap-0.5">
				<button
					type="button"
					onClick={onBack}
					disabled={!canGoBack}
					className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
					title="Back"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onForward}
					disabled={!canGoForward}
					className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
					title="Forward"
				>
					<ArrowRight className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onReload}
					className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
					title="Reload"
				>
					<RotateCcw className="h-3.5 w-3.5" />
				</button>
			</div>
			<form onSubmit={onSubmit} className="min-w-0 flex-1">
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onFocus={onFocus}
					onBlur={onBlur}
					placeholder={placeholder}
					className="h-8 w-full rounded-lg bg-secondary/60 px-3 text-[13px] text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
				/>
			</form>
		</div>
	);
}
