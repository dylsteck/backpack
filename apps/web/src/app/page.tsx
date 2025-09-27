"use client";

import UserMenu from "@/components/user-menu";
import { api } from "@command/backend/convex/_generated/api";
import { useQuery } from "convex/react";

export default function Home() {
	const currentUser = useQuery(api.auth.getCurrentUser);

	return (
		<div className="container mx-auto max-w-3xl px-4 py-8">
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h1 className="text-3xl font-bold">Welcome!</h1>
					<UserMenu />
				</div>
				
				<div className="grid gap-6">
					<section className="rounded-lg border p-6">
						<h2 className="mb-4 text-xl font-semibold">Account Info</h2>
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">
								<span className="font-medium">Name:</span> {currentUser?.name || "Loading..."}
							</p>
							<p className="text-sm text-muted-foreground">
								<span className="font-medium">Email:</span> {currentUser?.email || "Loading..."}
							</p>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
