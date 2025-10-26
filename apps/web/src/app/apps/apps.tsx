"use client";
import { authClient } from "@/lib/auth-client";

export default function Apps({
	session,
}: {
	session: typeof authClient.$Infer.Session;
}) {
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
