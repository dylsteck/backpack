"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import Header from "./header";
import AuthScreen from "./auth-screen";

export default function ConditionalLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			<Authenticated>
				<div className="grid grid-rows-[auto_1fr] h-svh">
					<Header />
					{children}
				</div>
			</Authenticated>
			<Unauthenticated>
				<AuthScreen />
			</Unauthenticated>
			<AuthLoading>
				<div className="flex items-center justify-center h-svh">
					<div className="text-lg">Loading...</div>
				</div>
			</AuthLoading>
		</>
	);
}
