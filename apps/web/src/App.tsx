import { A, useLocation, useNavigate } from "@solidjs/router";
import {
	Layout, ServerGate, Timeline, SourceCard, Settings, Onboarding,
	openExternalUrl, pickFolder, isTauri,
} from "@backpack/ui";
import type { OnboardingSource } from "@backpack/ui";
import { createBackpackClient } from "@backpack/api/client";
import { createResource, createSignal, createEffect, Show } from "solid-js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const client = createBackpackClient(API_URL);

export function App(props: { children?: unknown }) {
	const location = useLocation();
	const navigate = useNavigate();
	const [servers, { refetch }] = createResource(() => client.apps.getAvailableServers.query());

	const hasConnectedSource = () => {
		const data = servers();
		if (!data?.servers) return false;
		return data.servers.some(
			(s) => s.connection?.status === "connected"
		);
	};

	// Redirect to /setup if no sources connected (unless already on /setup)
	createEffect(() => {
		if (servers.loading) return;
		if (!hasConnectedSource() && location.pathname !== "/setup") {
			navigate("/setup", { replace: true });
		}
		if (hasConnectedSource() && location.pathname === "/setup") {
			navigate("/", { replace: true });
		}
	});

	const isSetupPage = () => location.pathname === "/setup";

	return (
		<ServerGate serverUrl={API_URL}>
			<Show when={!isSetupPage()} fallback={props.children as any}>
				<Layout
					nav={[
						{ href: "/", label: "Timeline" },
						{ href: "/sources", label: "Sources" },
					]}
					activePath={location.pathname}
					Link={(p) => <A href={p.href} class={p.class}>{p.children}</A>}
				>
					{props.children as any}
				</Layout>
			</Show>
		</ServerGate>
	);
}

export function TimelinePage() {
	const [timeline] = createResource(() => client.timeline.getTimeline.query({ limit: 50 }));
	const [servers] = createResource(() => client.apps.getAvailableServers.query());
	const [sourceFilter, setSourceFilter] = createSignal<string | null>(null);

	const availableSources = () => {
		const data = servers();
		if (!data?.servers) return [];
		return data.servers
			.filter((s) => s.connection?.status === "connected")
			.map((s) => s.id);
	};

	return (
		<div>
			<h1 class="mb-6 text-xl font-semibold text-[#e4e4ed]">Timeline</h1>
			<Timeline
				items={timeline()?.items ?? []}
				loading={timeline.loading}
				availableSources={availableSources()}
				sourceFilter={sourceFilter() ?? undefined}
				onSourceFilterChange={setSourceFilter}
			/>
		</div>
	);
}

export function SourcesPage() {
	const [servers, { refetch }] = createResource(() => client.apps.getAvailableServers.query());

	return (
		<div>
			<h1 class="mb-6 text-xl font-semibold text-[#e4e4ed]">Sources</h1>
			<div class="space-y-3">
				{servers.loading && (
					<div class="flex justify-center py-12">
						<div class="h-6 w-6 animate-spin rounded-full border-2 border-[#2a2a3a] border-t-[#4f46e5]" />
					</div>
				)}
				{servers()?.servers?.map((server) => (
					<SourceCard
						connection={{
							id: server.id,
							appId: server.id,
							appName: server.name,
							description: server.description ?? undefined,
							iconUrl: server.iconUrl ?? undefined,
							status: server.connection?.status ?? "disconnected",
							connection: server.connection ? {
								id: server.connection.id,
								status: server.connection.status,
								connectionMetadata: server.connection.connectionMetadata as { localPath?: string; fid?: string } | undefined,
							} : null,
						}}
						onConnect={async (appId) => {
							if (appId === "teller") {
								await openExternalUrl(`${API_URL}/teller/connect`);
							} else if (appId === "chrome") {
								await client.apps.connectChrome.mutate({ appId });
								refetch();
							} else if (appId === "brave") {
								await client.apps.connectBrave.mutate({ appId });
								refetch();
							}
						}}
						onDisconnect={async (appId) => {
							const server = servers()?.servers?.find((s) => s.id === appId);
							const connectionId = server?.connection?.id;
							if (connectionId) {
								await client.apps.removeConnection.mutate({ id: connectionId });
								refetch();
							}
						}}
						onPickFolder={
							isTauri()
								? async (appId) => {
										const path = await pickFolder();
										if (path && appId === "obsidian") {
											await client.apps.connectObsidian.mutate({ appId, vaultPath: path });
											refetch();
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

export function SetupPage() {
	const navigate = useNavigate();
	const [servers, { refetch }] = createResource(() => client.apps.getAvailableServers.query());

	const sources = (): OnboardingSource[] => {
		const data = servers();
		if (!data?.servers) return [];
		return data.servers.map((s) => ({
			id: s.id,
			name: s.name,
			description: s.description ?? undefined,
			iconUrl: s.iconUrl ?? undefined,
			connected: s.connection?.status === "connected",
			fields: getSourceFields(s.id),
		}));
	};

	const hasAtLeastOneConnected = () =>
		sources().some((s) => s.connected);

	const handleConnect = async (sourceId: string, data?: Record<string, string>) => {
		if (sourceId === "teller") {
			await openExternalUrl(`${API_URL}/teller/connect`);
		} else if (sourceId === "chrome") {
			await client.apps.connectChrome.mutate({ appId: sourceId });
			refetch();
		} else if (sourceId === "brave") {
			await client.apps.connectBrave.mutate({ appId: sourceId });
			refetch();
		} else if (sourceId === "farcaster" && data) {
			await client.apps.saveApiKey.mutate({
				appId: sourceId,
				apiKey: data.apiKey ?? "",
				connectionMetadata: { fid: data.fid ?? "" },
			});
			refetch();
		} else if (sourceId === "obsidian" && data?.vaultPath) {
			await client.apps.connectObsidian.mutate({ appId: sourceId, vaultPath: data.vaultPath });
			refetch();
		}
	};

	const handlePickFolder = async (sourceId: string) => {
		const path = await pickFolder();
		if (path) {
			await client.apps.connectObsidian.mutate({ appId: sourceId, vaultPath: path });
			refetch();
		}
	};

	return (
		<Onboarding
			sources={sources()}
			onConnectSource={handleConnect}
			onPickFolder={isTauri() ? handlePickFolder : undefined}
			onContinue={() => navigate("/")}
			hasAtLeastOneConnected={hasAtLeastOneConnected()}
		/>
	);
}

function getSourceFields(sourceId: string) {
	switch (sourceId) {
		case "obsidian":
			return [
				{ key: "vaultPath", label: "Vault Path", type: "folder" as const, placeholder: "/path/to/vault" },
			];
		case "farcaster":
			return [
				{ key: "apiKey", label: "Neynar API Key", type: "text" as const, placeholder: "NEYNAR_API_DOCS" },
				{ key: "fid", label: "Farcaster ID (FID)", type: "text" as const, placeholder: "3" },
			];
		case "chrome":
		case "brave":
			return [{ key: "auto", label: "Auto-detect", type: "auto" as const }];
		case "teller":
			return [{ key: "oauth", label: "OAuth", type: "oauth" as const }];
		default:
			return [];
	}
}

export function SettingsPage() {
	return (
		<div>
			<h1 class="mb-6 text-xl font-semibold text-[#e4e4ed]">Settings</h1>
			<Settings serverUrl={API_URL} />
		</div>
	);
}
