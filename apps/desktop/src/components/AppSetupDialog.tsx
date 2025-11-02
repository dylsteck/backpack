import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/utils/tailwind";

interface AppSetupDialogProps {
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
    } | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ImageWithFallback({
  src,
  alt,
  className,
  fallbackText,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackText: string;
}) {
  const [hasError, setHasError] = React.useState(false);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-muted-foreground/20 text-muted-foreground text-lg font-semibold",
          className
        )}
      >
        {fallbackText.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

export function AppSetupDialog({ app, open, onOpenChange }: AppSetupDialogProps) {
  const [apiKey, setApiKey] = React.useState("");
  const [fid, setFid] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [showCredentials, setShowCredentials] = React.useState(false);
  const [storedCredentials, setStoredCredentials] = React.useState<string | null>(null);
  const [loadingCredentials, setLoadingCredentials] = React.useState(false);

  const saveApiKeyMutation = (trpc as any).apps.saveApiKey.useMutation();
  const saveOAuthTokensMutation = (trpc as any).apps.saveOAuthTokens.useMutation();
  const getCredentialsQuery = (trpc as any).apps.getCredentials.useQuery(
    { connectionId: app?.connection?.id || "" },
    { enabled: false } // Don't auto-fetch, only fetch on demand
  );

  const connectionType = app?.connectionType || "mcp";
  const isMcp = connectionType === "mcp";
  const isApi = connectionType === "api";
  const requiresOAuth = app?.oauth === true;
  const isConnected = app?.connection?.status === "connected";
  const connection = app?.connection;
  const isFarcaster = app?.id === "farcaster" || app?.name.toLowerCase().includes("farcaster");

  React.useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setApiKey("");
      setFid("");
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
      setShowCredentials(false);
      setStoredCredentials(null);
    }
  }, [open]);

  const handleLoadCredentials = async () => {
    if (!app?.connection?.id) return;
    
    if (showCredentials) {
      // Hide credentials
      setShowCredentials(false);
      setStoredCredentials(null);
      return;
    }
    
    setLoadingCredentials(true);
    setError(null);
    try {
      const result = await getCredentialsQuery.refetch();
      if (result.data?.credentials) {
        setStoredCredentials(result.data.credentials);
        setShowCredentials(true);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load credentials");
    } finally {
      setLoadingCredentials(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!app || !apiKey.trim()) {
      setError("Please enter an API key");
      return;
    }

    if (isFarcaster && !fid.trim()) {
      setError("Please enter your Farcaster ID (FID)");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const connectionMetadata = isFarcaster && fid.trim() ? { fid: fid.trim() } : undefined;
      
      await saveApiKeyMutation.mutateAsync({
        appId: app.id,
        apiKey: apiKey.trim(),
        connectionMetadata,
      });
      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err: any) {
      console.error("Error saving API key:", err);
      // Handle tRPC errors - they might have a different structure
      const errorMessage = err?.data?.message || err?.message || err?.toString() || "Failed to save API key";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthConnect = async () => {
    if (!app) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get the server URL from config
      const serverUrl = app.config?.url;
      if (!serverUrl) {
        throw new Error("Server URL not found in app configuration");
      }

      // Create callback URL for OAuth
      const callbackUrl = `${window.location.origin}/api/apps/auth/callback`;
      const userId = "user"; // TODO: Get actual user ID from auth context

      // Initiate OAuth flow
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/apps/auth/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverUrl,
          callbackUrl,
          userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to initiate OAuth flow");
      }

      const data = await response.json();

      if (data.authUrl) {
        // Open OAuth URL in browser
        // In Electron, we might want to use shell.openExternal or a webview
        window.open(data.authUrl, "_blank");

        // Poll for OAuth completion
        // TODO: Implement proper OAuth callback handling
        // This is a simplified version - in production, use proper callback handling
        setError("OAuth flow initiated. Please complete authentication in the browser and return here.");
      } else {
        throw new Error("OAuth not available for this server");
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate OAuth flow");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!app) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <ImageWithFallback
              src={app.iconUrl}
              alt={app.name}
              className="h-12 w-12 rounded-lg object-contain border shrink-0"
              fallbackText={app.name}
            />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold">{app.name}</DialogTitle>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge variant={isMcp ? "default" : "secondary"} className="text-xs">
                  {connectionType.toUpperCase()}
                </Badge>
                {requiresOAuth && (
                  <Badge variant="outline" className="text-xs">OAuth</Badge>
                )}
                {isConnected && (
                  <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                    Connected
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {app.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-500 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              Successfully saved credentials!
            </div>
          )}

          {isConnected && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <div className="font-medium mb-2">Connection Details</div>
              <div className="space-y-1 text-xs text-muted-foreground mb-3">
                <div>Status: <span className="text-green-600 dark:text-green-400 font-medium">{connection?.status}</span></div>
                <div>Storage: <span className="font-medium">{connection?.credentialStorage}</span></div>
                <div>Transport: <span className="font-medium">{connection?.transportType}</span></div>
              </div>
              {connection?.id && (
                <Button
                  onClick={handleLoadCredentials}
                  variant="outline"
                  size="sm"
                  disabled={loadingCredentials}
                  className="w-full"
                >
                  {loadingCredentials ? "Loading..." : showCredentials ? "Hide Credentials" : "Show Credentials"}
                </Button>
              )}
              {showCredentials && storedCredentials && (
                <div className="mt-3 p-2 bg-background rounded border font-mono text-xs break-all">
                  {storedCredentials}
                </div>
              )}
            </div>
          )}

          {isApi ? (
            // API Key Input
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  API Key
                </label>
                <Input
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isSubmitting || success}
                  className="font-mono text-xs"
                />
              </div>
              {isFarcaster && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Farcaster ID (FID)
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter your FID"
                    value={fid}
                    onChange={(e) => setFid(e.target.value)}
                    disabled={isSubmitting || success}
                    className="font-mono text-xs"
                  />
                </div>
              )}
              <Button
                onClick={handleSaveApiKey}
                disabled={isSubmitting || success || !apiKey.trim() || (isFarcaster && !fid.trim())}
                className="w-full"
              >
                {isSubmitting ? "Saving..." : success ? "Saved!" : "Save API Key"}
              </Button>
            </div>
          ) : isMcp && requiresOAuth ? (
            // OAuth Flow
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This app requires OAuth authentication. Click the button below to connect your account.
              </p>
              <Button
                onClick={handleOAuthConnect}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Connecting..." : "Connect with OAuth"}
              </Button>
            </div>
          ) : (
            // Manual Setup (non-OAuth MCP)
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Manual setup required. Please configure environment variables or headers as needed.
              </p>
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

