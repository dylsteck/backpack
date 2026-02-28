import type { JSX } from "solid-js";
import { sourceBorder } from "./tokens";

export interface Connection {
	id: string;
	appId: string;
	appName: string;
	description?: string;
	iconUrl?: string;
	status: string;
	connection?: {
		id?: string;
		status: string;
		connectionMetadata?: { localPath?: string; fid?: string };
	} | null;
	lastSynced?: string | null;
}

export interface SourceCardProps {
	connection: Connection;
	onConnect?: (appId: string) => void;
	onDisconnect?: (appId: string) => void;
	onPickFolder?: (appId: string) => void;
	onSync?: (appId: string) => void;
	children?: JSX.Element;
}

export function SourceCard(props: SourceCardProps) {
	const isConnected = () =>
		props.connection.status === "connected" || props.connection.connection?.status === "connected";
	const isObsidian = () => props.connection.appId === "obsidian";

	const borderColor = () => sourceBorder[props.connection.appId] ?? "border-[#8b8ba0]";

	return (
		<div class={`rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 border-l-2 ${borderColor()}`}>
			<div class="flex items-start justify-between gap-4">
				<div class="flex items-start gap-3">
					{props.connection.iconUrl && (
						<img
							src={props.connection.iconUrl}
							alt=""
							class="h-8 w-8 rounded"
						/>
					)}
					<div>
						<h3 class="font-medium text-[#e4e4ed]">{props.connection.appName}</h3>
						{props.connection.description && (
							<p class="mt-0.5 text-sm text-[#5a5a70]">{props.connection.description}</p>
						)}
						<div class="mt-2 flex items-center gap-2">
							{isConnected() ? (
								<>
									<span class="inline-block h-2 w-2 rounded-full bg-green-500" />
									<span class="text-sm text-[#8b8ba0]">Connected</span>
								</>
							) : (
								<>
									<span class="inline-block h-2 w-2 rounded-full bg-[#5a5a70]" />
									<span class="text-sm text-[#8b8ba0]">Not connected</span>
								</>
							)}
						</div>
						{isConnected() && (
							<div class="mt-1.5 space-y-0.5">
								{isObsidian() && props.connection.connection?.connectionMetadata?.localPath && (
									<p class="text-xs text-[#5a5a70]">
										Vault: {props.connection.connection.connectionMetadata.localPath}
									</p>
								)}
								{props.connection.connection?.connectionMetadata?.fid && (
									<p class="text-xs text-[#5a5a70]">
										FID: {props.connection.connection.connectionMetadata.fid}
									</p>
								)}
								{props.connection.lastSynced && (
									<p class="text-xs text-[#5a5a70]">
										Last synced: {props.connection.lastSynced}
									</p>
								)}
							</div>
						)}
					</div>
				</div>
				<div class="flex shrink-0 gap-2">
					{isConnected() ? (
						<>
							{props.onSync && (
								<button
									type="button"
									onClick={() => props.onSync?.(props.connection.appId)}
									class="rounded-md border border-[#2a2a3a] px-3 py-1.5 text-sm text-[#8b8ba0] hover:bg-[#1a1a25] hover:text-[#e4e4ed] transition-colors"
								>
									Sync Now
								</button>
							)}
							{props.onDisconnect && (
								<button
									type="button"
									onClick={() => props.onDisconnect?.(props.connection.appId)}
									class="rounded-md border border-[#2a2a3a] px-3 py-1.5 text-sm text-[#8b8ba0] hover:bg-[#1a1a25] hover:text-[#e4e4ed] transition-colors"
								>
									Disconnect
								</button>
							)}
						</>
					) : (
						<>
							{isObsidian() && props.onPickFolder ? (
								<button
									type="button"
									onClick={() => props.onPickFolder?.(props.connection.appId)}
									class="rounded-md bg-[#4f46e5] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4338ca] transition-colors"
								>
									Connect
								</button>
							) : props.onConnect && (
								<button
									type="button"
									onClick={() => props.onConnect?.(props.connection.appId)}
									class="rounded-md bg-[#4f46e5] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4338ca] transition-colors"
								>
									Connect
								</button>
							)}
						</>
					)}
				</div>
			</div>
			{props.children}
		</div>
	);
}
