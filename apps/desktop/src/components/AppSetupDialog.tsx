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
import { setupDeepLinkListener, type DeepLinkCallbackData } from "@/lib/deepLink";

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
      connectionMetadata?: any;
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
  const [chromePath, setChromePath] = React.useState("");
  const [detectingPath, setDetectingPath] = React.useState(false);
  const [bravePath, setBravePath] = React.useState("");
  const [detectingBravePath, setDetectingBravePath] = React.useState(false);
  const [stripeSessionToken, setStripeSessionToken] = React.useState<string | null>(null);
  const [stripePolling, setStripePolling] = React.useState(false);
  const [stripePollingError, setStripePollingError] = React.useState<string | null>(null);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const saveApiKeyMutation = (trpc as any).apps.saveApiKey.useMutation();
  const saveOAuthTokensMutation = (trpc as any).apps.saveOAuthTokens.useMutation();
  const connectChromeMutation = (trpc as any).apps.connectChrome.useMutation();
  const connectBraveMutation = (trpc as any).apps.connectBrave.useMutation();
  const getCredentialsQuery = (trpc as any).apps.getCredentials.useQuery(
    { connectionId: app?.connection?.id || "" },
    { enabled: false } // Don't auto-fetch, only fetch on demand
  );
  // Stripe mutations - must be at component level, not inside handlers
  const saveStripeAccountsMutation = (trpc as any).stripe.saveConnectedAccounts.useMutation();
  const syncStripeTransactionsMutation = (trpc as any).stripe.syncAccountTransactions.useMutation();

  const connectionType = app?.connectionType || "mcp";
  const isMcp = connectionType === "mcp";
  const isApi = connectionType === "api";
  const isFile = connectionType === "file";
  const isChrome = app?.id === "chrome" || app?.name.toLowerCase().includes("chrome");
  const isBrave = app?.id === "brave" || app?.name.toLowerCase().includes("brave");
  const requiresOAuth = app?.oauth === true;
  const isConnected = app?.connection?.status === "connected";
  const connection = app?.connection;
  const isFarcaster = app?.id === "farcaster" || app?.name.toLowerCase().includes("farcaster");
  const isStripe = app?.id === "stripe" || app?.name.toLowerCase().includes("stripe");

  // Handle Stripe completion (from deep link or polling) - memoized to avoid dependency issues
  const handleStripeCompletion = React.useCallback(async (data: DeepLinkCallbackData) => {
    if (!data.success || !data.accountIds || data.accountIds.length === 0) {
      setError(data.error || "Failed to connect accounts");
      setStripePolling(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsSubmitting(false);
      return;
    }

    try {
      // Save connected accounts
      await saveStripeAccountsMutation.mutateAsync({
        accountIds: data.accountIds,
        customerId: data.customerId || "",
      });

      // Sync transactions for each account
      for (const accountId of data.accountIds) {
        try {
          await syncStripeTransactionsMutation.mutateAsync({ accountId });
        } catch (syncError) {
          console.error(`Failed to sync transactions for account ${accountId}:`, syncError);
        }
      }

      setSuccess(true);
      setError(null);
      setStripePolling(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsSubmitting(false);

      // Close dialog and refresh after a delay
      setTimeout(() => {
        onOpenChange(false);
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      console.error("Error completing Stripe connection:", err);
      setError(err?.message || "Failed to save connection");
      setStripePolling(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsSubmitting(false);
    }
  }, [saveStripeAccountsMutation, syncStripeTransactionsMutation, onOpenChange]);

  // Set up deep link listener
  React.useEffect(() => {
    if (!open || !isStripe || !stripeSessionToken) return;

    const cleanup = setupDeepLinkListener((data: DeepLinkCallbackData) => {
      if (data.sessionToken === stripeSessionToken) {
        handleStripeCompletion(data);
      }
    });

    return cleanup;
  }, [open, isStripe, stripeSessionToken, handleStripeCompletion]);

  // Cleanup polling on unmount or dialog close
  React.useEffect(() => {
    if (!open) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setStripeSessionToken(null);
      setStripePolling(false);
      setStripePollingError(null);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setApiKey("");
      setFid("");
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
      setShowCredentials(false);
      setStoredCredentials(null);
      setChromePath("");
      setDetectingPath(false);
      setBravePath("");
      setDetectingBravePath(false);
      setStripeSessionToken(null);
      setStripePolling(false);
      setStripePollingError(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (open && isFile && isChrome && !chromePath && !detectingPath) {
      if (window.chromeHistory && typeof window.chromeHistory.detectHistoryPath === "function") {
        handleDetectChromePath();
      } else {
        setChromePath("~/Library/Application Support/Google/Chrome/Default/History");
      }
    }
  }, [open, isFile, isChrome]);

  React.useEffect(() => {
    if (open && isFile && isBrave && !bravePath && !detectingBravePath) {
      if (window.braveHistory && typeof window.braveHistory.detectHistoryPath === "function") {
        handleDetectBravePath();
      } else {
        setBravePath("~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History");
      }
    }
  }, [open, isFile, isBrave]);

  const handleDetectChromePath = async () => {
    if (!window.chromeHistory || typeof window.chromeHistory.detectHistoryPath !== "function") {
      setError("Auto-detection not available. You can manually enter the path below.");
      return;
    }
    
    setDetectingPath(true);
    setError(null);
    try {
      const result = await window.chromeHistory.detectHistoryPath();
      if (result.success && result.defaultPath) {
        setChromePath(result.defaultPath);
        const verifyResult = await window.chromeHistory.verifyPath(result.defaultPath);
        if (!verifyResult.success && verifyResult.error) {
          setError(verifyResult.error);
        }
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to detect Chrome path. You can enter it manually.");
    } finally {
      setDetectingPath(false);
    }
  };

  const handleConnectChrome = async () => {
    if (!app || !chromePath.trim()) {
      setError("Please select a Chrome history database path");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await connectChromeMutation.mutateAsync({
        appId: app.id,
        localPath: chromePath.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err: any) {
      console.error("Error connecting Chrome:", err);
      const errorMessage = err?.data?.message || err?.message || err?.toString() || "Failed to connect Chrome";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetectBravePath = async () => {
    if (!window.braveHistory || typeof window.braveHistory.detectHistoryPath !== "function") {
      setError("Auto-detection not available. You can manually enter the path below.");
      return;
    }
    
    setDetectingBravePath(true);
    setError(null);
    try {
      const result = await window.braveHistory.detectHistoryPath();
      if (result.success && result.defaultPath) {
        setBravePath(result.defaultPath);
        const verifyResult = await window.braveHistory.verifyPath(result.defaultPath);
        if (!verifyResult.success && verifyResult.error) {
          setError(verifyResult.error);
        }
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to detect Brave path. You can enter it manually.");
    } finally {
      setDetectingBravePath(false);
    }
  };

  const handleConnectBrave = async () => {
    if (!app || !bravePath.trim()) {
      setError("Please select a Brave history database path");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await connectBraveMutation.mutateAsync({
        appId: app.id,
        localPath: bravePath.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err: any) {
      console.error("Error connecting Brave:", err);
      const errorMessage = err?.data?.message || err?.message || err?.toString() || "Failed to connect Brave";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Generate session token for Stripe OAuth
  const generateSessionToken = (): string => {
    return `stripe_${Math.random().toString(36).substring(2)}_${Date.now().toString(36)}`;
  };

  // Poll for Stripe connection status
  const pollStripeStatus = async (token: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/stripe/status/${token}`);
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === "completed") {
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setStripePolling(false);
        
        // Handle completion
        await handleStripeCompletion({
          success: true,
          sessionToken: token,
          accountIds: data.accountIds || [],
          customerId: data.customerId,
          error: null,
        });
      } else if (data.status === "error") {
        // Stop polling on error
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setStripePolling(false);
        setError(data.error || "Connection failed");
        setIsSubmitting(false);
      }
      // If pending, continue polling
    } catch (err: any) {
      console.error("Error polling Stripe status:", err);
      setStripePollingError(err?.message || "Failed to check status");
      // Continue polling on network errors
    }
  };

  const handleStripeConnect = async () => {
    if (!app) return;

    setIsSubmitting(true);
    setError(null);
    setStripePollingError(null);

    try {
      // Generate session token
      const sessionToken = generateSessionToken();
      setStripeSessionToken(sessionToken);

      // Open browser with server URL
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const connectUrl = `${apiUrl}/stripe/connect?token=${sessionToken}`;
      
      // Use Electron IPC to open in default browser (Chrome, etc.)
      if (typeof window !== "undefined" && (window as any).electronWindow?.openExternal) {
        await (window as any).electronWindow.openExternal(connectUrl);
      } else if (typeof window !== "undefined" && (window as any).require) {
        // Fallback to direct require if IPC not available
        const { shell } = (window as any).require("electron");
        await shell.openExternal(connectUrl);
      } else {
        // Fallback to window.open if not in Electron
        window.open(connectUrl, "_blank");
      }

      // Start polling
      setStripePolling(true);
      pollingIntervalRef.current = setInterval(() => {
        pollStripeStatus(sessionToken);
      }, 2000); // Poll every 2 seconds

      // Timeout after 5 minutes (150 attempts)
      setTimeout(() => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (stripePolling) {
          setStripePolling(false);
          setError("Connection timed out. Please try again.");
          setIsSubmitting(false);
        }
      }, 5 * 60 * 1000);
    } catch (err: any) {
      console.error("Error initiating Stripe connection:", err);
      setError(err?.message || "Failed to open browser");
      setIsSubmitting(false);
    }
  };

  const handleOAuthConnect = async () => {
    if (!app) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Stripe Financial Connections uses browser-based flow
      if (isStripe) {
        await handleStripeConnect();
        return;
      } else {
        // Generic OAuth flow for other apps
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
                <Badge variant={isMcp ? "default" : isFile ? "default" : "secondary"} className="text-xs">
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
                {!isFile && (
                  <>
                <div>Storage: <span className="font-medium">{connection?.credentialStorage}</span></div>
                <div>Transport: <span className="font-medium">{connection?.transportType}</span></div>
                  </>
                )}
                {isFile && (
                  <div>Path: <span className="font-mono font-medium text-xs break-all">{connection?.connectionMetadata?.localPath || "N/A"}</span></div>
                )}
              </div>
              {connection?.id && !isFile && (
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

              {isApi && requiresOAuth && isStripe ? (
                // Stripe OAuth Flow (Browser-based)
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connect your bank accounts using Stripe Financial Connections. Click the button below to open your browser and complete the connection.
                  </p>
                  {stripePolling && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 text-sm text-blue-700 dark:text-blue-300">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                        <span>Waiting for browser connection...</span>
                      </div>
                      {stripePollingError && (
                        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                          {stripePollingError}
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={handleStripeConnect}
                    disabled={isSubmitting || stripePolling}
                    className="w-full"
                  >
                    {stripePolling ? "Waiting for connection..." : isSubmitting ? "Opening browser..." : "Connect Bank Accounts"}
                  </Button>
                  {stripePolling && (
                    <p className="text-xs text-muted-foreground text-center">
                      Complete the connection in your browser. This dialog will close automatically when done.
                    </p>
                  )}
                </div>
              ) : isApi ? (
            // API Key Input (for non-OAuth API apps like Farcaster)
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
          ) : isFile && isChrome ? (
            // Chrome File Connection
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Chrome History Database Path
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="~/Library/Application Support/Google/Chrome/Default/History"
                    value={chromePath}
                    onChange={(e) => setChromePath(e.target.value)}
                    disabled={isSubmitting || success || detectingPath}
                    className="font-mono text-xs"
                  />
                  {window.chromeHistory && typeof window.chromeHistory.detectHistoryPath === "function" && (
                    <Button
                      onClick={handleDetectChromePath}
                      variant="outline"
                      size="sm"
                      disabled={detectingPath || isSubmitting}
                    >
                      {detectingPath ? "Detecting..." : "Detect"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {window.chromeHistory && typeof window.chromeHistory.detectHistoryPath === "function"
                    ? "We'll automatically detect your Chrome history database location, or you can enter it manually."
                    : "Enter the path to your Chrome History database file."}
                </p>
              </div>
              <Button
                onClick={handleConnectChrome}
                disabled={isSubmitting || success || !chromePath.trim() || detectingPath}
                className="w-full"
              >
                {isSubmitting ? "Connecting..." : success ? "Connected!" : "Connect Chrome"}
              </Button>
            </div>
          ) : isFile && isBrave ? (
            // Brave File Connection
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Brave History Database Path
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History"
                    value={bravePath}
                    onChange={(e) => setBravePath(e.target.value)}
                    disabled={isSubmitting || success || detectingBravePath}
                    className="font-mono text-xs"
                  />
                  {window.braveHistory && typeof window.braveHistory.detectHistoryPath === "function" && (
                    <Button
                      onClick={handleDetectBravePath}
                      variant="outline"
                      size="sm"
                      disabled={detectingBravePath || isSubmitting}
                    >
                      {detectingBravePath ? "Detecting..." : "Detect"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {window.braveHistory && typeof window.braveHistory.detectHistoryPath === "function"
                    ? "We'll automatically detect your Brave history database location, or you can enter it manually."
                    : "Enter the path to your Brave History database file."}
                </p>
              </div>
              <Button
                onClick={handleConnectBrave}
                disabled={isSubmitting || success || !bravePath.trim() || detectingBravePath}
                className="w-full"
              >
                {isSubmitting ? "Connecting..." : success ? "Connected!" : "Connect Brave"}
              </Button>
            </div>
          ) : (isMcp || isApi) && requiresOAuth ? (
            // OAuth Flow (for MCP or API apps that require OAuth)
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

