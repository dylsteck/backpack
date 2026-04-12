import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	CircleDot,
	Database,
	Package,
	Plug,
} from "lucide-react";
import { backpack } from "@/lib/backpack-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type Step = 1 | 2 | 3;

export function OnboardingFlow() {
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [step, setStep] = useState<Step>(1);

	const currentPath = useQuery({
		queryKey: ["db-path"],
		queryFn: () => backpack.dbPath(),
	});
	const [path, setPath] = useState("");
	const [pathError, setPathError] = useState<string | null>(null);

	const setDbPath = useMutation({
		mutationFn: (next: string) => backpack.setDbPath(next),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["db-path"] });
			setStep(3);
		},
	});

	const apps = useQuery({
		queryKey: ["apps"],
		queryFn: () => backpack.apps(),
	});
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const toggleApp = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleSavePath = () => {
		const resolved = (path || currentPath.data || "").trim();
		if (!resolved) {
			setPathError("Path cannot be empty.");
			return;
		}
		setPathError(null);
		setDbPath.mutate(resolved);
	};

	return (
		<div className="flex h-full items-center justify-center p-6">
			<Card className="w-full max-w-2xl shadow-xl shadow-black/5">
				{step === 1 && (
					<>
						<CardHeader>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
									<Package className="h-5 w-5" />
								</div>
								<div className="flex flex-col gap-1">
									<CardTitle>Welcome to Backpack</CardTitle>
									<CardDescription>
										Your personal, local-first data hub.
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent className="flex flex-col gap-6">
							<p className="text-sm text-muted-foreground">
								Backpack stores everything locally in SQLite. Pick a database
								path, then connect your first source.
							</p>
							<div className="flex justify-end">
								<Button onClick={() => setStep(2)}>
									Get started
									<ArrowRight />
								</Button>
							</div>
							<StepIndicator step={step} />
						</CardContent>
					</>
				)}

				{step === 2 && (
					<>
						<CardHeader>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
									<Database className="h-5 w-5" />
								</div>
								<div className="flex flex-col gap-1">
									<CardTitle>Database path</CardTitle>
									<CardDescription>
										Choose where Backpack stores its SQLite database.
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<div className="flex flex-col gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									Current path
								</span>
								<span className="truncate rounded-md border bg-muted/40 px-3 py-2 text-xs">
									{currentPath.data ?? "Loading…"}
								</span>
							</div>
							<div className="flex flex-col gap-1">
								<label
									htmlFor="db-path-input"
									className="text-xs font-medium text-muted-foreground"
								>
									New path
								</label>
								<Input
									id="db-path-input"
									placeholder="/absolute/path/to/backpack.db"
									value={path || currentPath.data || ""}
									onChange={(e) => {
										setPath(e.target.value);
										if (pathError) setPathError(null);
									}}
								/>
								{pathError && (
									<p className="text-xs text-destructive">{pathError}</p>
								)}
								{setDbPath.isError && !pathError && (
									<p className="text-xs text-destructive">
										{(setDbPath.error as Error).message}
									</p>
								)}
							</div>
							<div className="flex items-center justify-between gap-2">
								<Button variant="ghost" onClick={() => setStep(1)}>
									<ArrowLeft />
									Back
								</Button>
								<Button
									onClick={handleSavePath}
									disabled={setDbPath.isPending}
								>
									{setDbPath.isPending ? "Saving…" : "Save"}
									{!setDbPath.isPending && <ArrowRight />}
								</Button>
							</div>
							<StepIndicator step={step} />
						</CardContent>
					</>
				)}

				{step === 3 && (
					<>
						<CardHeader>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
									<Plug className="h-5 w-5" />
								</div>
								<div className="flex flex-col gap-1">
									<CardTitle>Connect a source</CardTitle>
									<CardDescription>
										{`Pick sources you'd like to pull data from. You'll connect them from the app detail page.`}
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{apps.isLoading && (
								<p className="text-sm text-muted-foreground">
									Loading sources…
								</p>
							)}
							{apps.isError && (
								<p className="text-sm text-destructive">
									Failed to load sources.
								</p>
							)}
							{apps.data && apps.data.length === 0 && (
								<p className="text-sm text-muted-foreground">
									No sources available.
								</p>
							)}
							{apps.data && apps.data.length > 0 && (
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									{apps.data.map((app) => {
										const isSelected = selected.has(app.id);
										return (
											<button
												key={app.id}
												type="button"
												onClick={() => toggleApp(app.id)}
												className={cn(
													"flex flex-col items-start gap-2 rounded-xl bg-card/60 p-3 text-left transition-all duration-200 hover:bg-card hover:shadow-sm",
													isSelected &&
														"bg-primary/5 shadow-sm ring-1 ring-primary/30",
												)}
											>
												<div className="flex w-full items-center justify-between gap-2">
													<div className="flex items-center gap-2">
														<div
															className={cn(
																"flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground",
																isSelected && "text-primary",
															)}
														>
															{isSelected ? (
																<CheckCircle2 className="h-4 w-4" />
															) : app.oauth ? (
																<Plug className="h-4 w-4" />
															) : (
																<CircleDot className="h-4 w-4" />
															)}
														</div>
														<span className="text-sm font-medium">
															{app.name}
														</span>
													</div>
													{app.oauth && (
														<span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
															OAuth
														</span>
													)}
												</div>
												<p className="line-clamp-2 text-xs text-muted-foreground">
													{app.description}
												</p>
											</button>
										);
									})}
								</div>
							)}
							<div className="flex items-center justify-between gap-2">
								<Button variant="ghost" onClick={() => setStep(2)}>
									<ArrowLeft />
									Back
								</Button>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										onClick={() => navigate({ to: "/" })}
									>
										Skip for now
									</Button>
									<Button
										disabled={selected.size === 0}
										onClick={() => navigate({ to: "/apps" })}
									>
										Finish
										<ArrowRight />
									</Button>
								</div>
							</div>
							<StepIndicator step={step} />
						</CardContent>
					</>
				)}
			</Card>
		</div>
	);
}

function StepIndicator({ step }: { step: Step }) {
	return (
		<div className="flex items-center justify-center gap-2 pt-2">
			{[1, 2, 3].map((n) => (
				<span
					key={n}
					className={cn(
						"h-1.5 rounded-full transition-all duration-300",
						n === step
							? "w-6 bg-primary"
							: "w-1.5 bg-muted-foreground/30",
					)}
				/>
			))}
		</div>
	);
}
