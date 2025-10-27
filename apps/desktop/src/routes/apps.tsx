import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/apps")({
	component: AppsPage,
});

function AppsPage() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-center">
					<p className="text-2xl text-slate-400 dark:text-slate-500">Loading...</p>
				</div>
			</div>
		);
	}

	if (!session?.user) {
		return <Navigate to="/login" />;
	}

	return (
		<div className="flex items-center justify-center min-h-[60vh]">
			<div className="text-center">
				<p className="text-2xl text-slate-400 dark:text-slate-500">
					No apps yet
				</p>
			</div>
		</div>
	);
}

