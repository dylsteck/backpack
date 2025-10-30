import { useState } from "react";
import {
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Button,
	Checkbox,
	Label,
	Separator,
	Badge,
	ScrollArea,
} from "@cortex/ui/components";
import { Filter, X, Search } from "lucide-react";

const TRANSPORT_TYPES = [
	{ value: "http", label: "http" },
	{ value: "https", label: "https" },
	{ value: "sse", label: "sse" },
	{ value: "stdio", label: "stdio" },
	{ value: "streamable-http", label: "streamable-http" },
] as const;

const AUTH_TYPES = [
	{ value: "oauth", label: "OAuth" },
	{ value: "no-oauth", label: "No OAuth" },
] as const;

interface MCPFiltersProps {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	selectedTransports: string[];
	onTransportsChange: (transports: string[]) => void;
	selectedAuth: string[];
	onAuthChange: (auth: string[]) => void;
}

export default function MCPFilters({
	searchQuery,
	onSearchChange,
	selectedTransports,
	onTransportsChange,
	selectedAuth,
	onAuthChange,
}: MCPFiltersProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleTransportToggle = (transport: string) => {
		if (selectedTransports.includes(transport)) {
			onTransportsChange(selectedTransports.filter((t) => t !== transport));
		} else {
			onTransportsChange([...selectedTransports, transport]);
		}
	};

	const handleAuthToggle = (auth: string) => {
		if (selectedAuth.includes(auth)) {
			onAuthChange(selectedAuth.filter((a) => a !== auth));
		} else {
			onAuthChange([...selectedAuth, auth]);
		}
	};

	const clearFilters = () => {
		onTransportsChange([]);
		onAuthChange([]);
	};

	const activeFilterCount = selectedTransports.length + selectedAuth.length;

	return (
		<div className="flex gap-3 w-full">
			<div className="relative flex-1">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
				<Input
					type="text"
					placeholder="Search servers by name, description, or transport..."
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					className="flex-1 h-10 pl-9 pr-4"
				/>
			</div>
			<Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className="relative h-10 px-4 gap-2 whitespace-nowrap"
					>
						<Filter className="h-4 w-4 shrink-0" />
						<span className="font-medium">Filters</span>
						{activeFilterCount > 0 && (
							<Badge
								variant="default"
								className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] font-semibold leading-none flex items-center justify-center rounded-full"
							>
								{activeFilterCount}
							</Badge>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent 
					align="end" 
					className="w-[340px] p-0" 
					sideOffset={8}
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<div className="flex flex-col max-h-[480px]">
						{/* Header */}
						<div className="flex items-center justify-between p-4 border-b">
							<div className="flex items-center gap-2.5">
								<div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
									<Filter className="h-4 w-4 text-primary" />
								</div>
								<div className="flex items-center gap-2">
									<h4 className="font-semibold text-sm">Filters</h4>
									{activeFilterCount > 0 && (
										<Badge
											variant="secondary"
											className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold"
										>
											{activeFilterCount}
										</Badge>
									)}
								</div>
							</div>
							{activeFilterCount > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={clearFilters}
									className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
								>
									<X className="h-3.5 w-3.5 mr-1.5" />
									Clear all
								</Button>
							)}
						</div>

						{/* Scrollable Content */}
						<ScrollArea className="flex-1">
							<div className="p-4 space-y-6">
								{/* Transport Section */}
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											Transport
										</h5>
										<Separator className="flex-1" />
									</div>
									<div className="space-y-1">
										{TRANSPORT_TYPES.map((transport) => {
											const isChecked = selectedTransports.includes(transport.value);
											return (
												<label
													key={transport.value}
													htmlFor={`transport-${transport.value}`}
													className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors group"
												>
													<Checkbox
														id={`transport-${transport.value}`}
														checked={isChecked}
														onCheckedChange={() => handleTransportToggle(transport.value)}
														className="shrink-0"
													/>
													<span className="text-sm font-medium text-foreground group-hover:text-foreground flex-1">
														{transport.label}
													</span>
													{isChecked && (
														<Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
															Selected
														</Badge>
													)}
												</label>
											);
										})}
									</div>
								</div>

								{/* Authentication Section */}
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											Authentication
										</h5>
										<Separator className="flex-1" />
									</div>
									<div className="space-y-1">
										{AUTH_TYPES.map((auth) => {
											const isChecked = selectedAuth.includes(auth.value);
											return (
												<label
													key={auth.value}
													htmlFor={`auth-${auth.value}`}
													className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors group"
												>
													<Checkbox
														id={`auth-${auth.value}`}
														checked={isChecked}
														onCheckedChange={() => handleAuthToggle(auth.value)}
														className="shrink-0"
													/>
													<span className="text-sm font-medium text-foreground group-hover:text-foreground flex-1">
														{auth.label}
													</span>
													{isChecked && (
														<Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
															Selected
														</Badge>
													)}
												</label>
											);
										})}
									</div>
								</div>
							</div>
						</ScrollArea>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}

