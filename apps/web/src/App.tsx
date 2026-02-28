import { A } from "@solidjs/router";
import { Layout, ServerGate, Timeline, ConnectionCard, Settings, openExternalUrl, pickFolder, isTauri } from "@backpack/ui";
import { createBackpackClient } from "@backpack/api/client";
import { createResource } from "solid-js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const client = createBackpackClient(API_URL);

export function App(props: { children?: unknown }) {
	return (
		<ServerGate serverUrl={API_URL}>
			<Layout
				nav={[
					{ href: "/", label: "Timeline" },
					{ href: "/connections", label: "Connections" },
					{ href: "/settings", label: "Settings" },
				]}
				Link={(p) => <A href={p.href} class={p.class}>{p.children}</A>}
			>
				{props.children as any}
			</Layout>
		</ServerGate>
	);
}

export function TimelinePage() {
	const [timeline] = createResource(() => client.timeline.getTimeline.query({ limit: 50 }));

	return (
		<div>
			<h1 class="mb-6 text-xl font-semibold text-zinc-100">Timeline</h1>
			<Timeline
				items={timeline()?.items ?? []}
				loading={timeline.loading}
			/>
		</div>
	);
}

export function ConnectionsPage() {
	const [servers] = createResource(() => client.apps.getAvailableServers.query());

	return (
		<div>
			<h1 class="mb-6 text-xl font-semibold text-zinc-100">Connections</h1>
			<div class="space-y-4">
				{servers.loading && (
					<div class="flex justify-center py-8">
						<div class="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
					</div>
				)}
				{servers()?.servers?.map((server) => (
					<ConnectionCard
						connection={{
							id: server.id,
							appId: server.id,
							appName: server.name,
							status: server.connection?.status ?? "disconnected",
							connection: server.connection,
						}}
						onConnect={async (appId) => {
							if (appId === "teller") {
								await openExternalUrl(`${API_URL}/teller/connect`);
							}
						}}
						onDisconnect={async (appId) => {
							const server = servers()?.servers?.find((s) => s.id === appId);
							const connectionId = server?.connection?.id;
							if (connectionId) {
								await client.apps.removeConnection.mutate({ id: connectionId });
								servers.refetch();
							}
						}}
						onPickFolder={
							isTauri()
								? async (appId) => {
										const path = await pickFolder();
										if (path && appId === "obsidian") {
											await client.apps.connectObsidian.mutate({ appId, vaultPath: path });
											servers.refetch();
										}
									}
								: undefined
						}
					/>
				))}
			</div>
		</div>
	);
}

export function SettingsPage() {
	return (
		<div>
			<h1 class="mb-6 text-xl font-semibold text-zinc-100">Settings</h1>
			<Settings serverUrl={API_URL} />
		</div>
	);
}

