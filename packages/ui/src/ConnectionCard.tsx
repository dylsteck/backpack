import type { JSX } from "solid-js";

export interface Connection {
	id: string;
	appId: string;
	appName: string;
	status: string;
	connection?: {
		status: string;
		connectionMetadata?: { localPath?: string; fid?: string };
	} | null;
}

export interface ConnectionCardProps {
	connection: Connection;
	onConnect?: (appId: string) => void;
	onDisconnect?: (appId: string) => void;
	/** Desktop-only: trigger folder picker for Obsidian */
	onPickFolder?: (appId: string) => void;
	children?: JSX.Element;
}

export function ConnectionCard(props: ConnectionCardProps) {
	const isConnected = () => props.connection.status === "connected" || props.connection.connection?.status === "connected";
	const isObsidian = () => props.connection.appId === "obsidian";

	return (
		<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="font-medium text-zinc-100">{props.connection.appName}</h3>
					<p class="mt-1 text-sm text-zinc-500">
						{isConnected()
							? isObsidian()
								? props.connection.connection?.connectionMetadata?.localPath ?? "Vault connected"
								: "Connected"
							: "Not connected"}
					</p>
				</div>
				<div class="flex gap-2">
					{isConnected() ? (
						props.onDisconnect && (
							<button
								type="button"
								onClick={() => props.onDisconnect?.(props.connection.appId)}
								class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
							>
								Disconnect
							</button>
						)
					) : (
						<>
							{isObsidian() && props.onPickFolder && (
								<button
									type="button"
									onClick={() => props.onPickFolder?.(props.connection.appId)}
									class="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
								>
									Pick folder
								</button>
							)}
							{props.onConnect && !isObsidian() && (
								<button
									type="button"
									onClick={() => props.onConnect?.(props.connection.appId)}
									class="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
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
