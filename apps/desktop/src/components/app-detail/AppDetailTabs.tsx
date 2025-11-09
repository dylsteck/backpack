import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AppTimeline } from "./AppTimeline";
import { AppSettings } from "./AppSettings";

interface AppDetailTabsProps {
	app: {
		id: string;
		name: string;
		description: string;
		oauth: boolean;
		iconUrl: string;
		config: {
			url?: string;
			command?: string;
			args?: string[];
			env?: Record<string, string>;
			headers?: Record<string, string>;
			oas?: string;
		};
		connectionType?: string;
		connection?: {
			id: string;
			status: "connected" | "disconnected" | "error";
			credentialStorage: string;
			secretUri?: string | null;
			transportType: string;
			transportConfig: any;
			connectionMetadata?: any;
		} | null;
	};
	isConnected: boolean;
}

export function AppDetailTabs({ app, isConnected }: AppDetailTabsProps) {
	const [activeTab, setActiveTab] = React.useState("home");

	// For Stripe, default to settings if not connected or no data
	React.useEffect(() => {
		if (app.id === "stripe" && isConnected && !app.connection?.connectionMetadata?.accountIds) {
			setActiveTab("settings");
		}
	}, [app.id, isConnected, app.connection]);

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
			<TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
				<TabsTrigger value="home">Home</TabsTrigger>
				<TabsTrigger value="settings">Settings</TabsTrigger>
			</TabsList>
			
			<TabsContent value="home" className="flex-1 mt-0 min-h-[400px]">
				{isConnected ? (
					<AppTimeline appId={app.id} iconUrl={app.iconUrl} />
				) : (
					<div className="flex flex-col items-center justify-center py-16 min-h-[400px] rounded-lg border border-dashed bg-muted/20">
						<div className="text-center space-y-3 max-w-md">
							<p className="text-base font-medium text-foreground">Connect {app.name} to see timeline activity</p>
							<p className="text-sm text-muted-foreground">Go to Settings to connect and start viewing activity from this app.</p>
						</div>
					</div>
				)}
			</TabsContent>
			
			<TabsContent value="settings" className="mt-0">
				<AppSettings app={app} isConnected={isConnected} />
			</TabsContent>
		</Tabs>
	);
}

