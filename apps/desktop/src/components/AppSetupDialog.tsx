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

// Teller Connect types
interface TellerEnrollment {
  accessToken: string;
  enrollment: {
    id: string;
    institution: {
      name: string;
    };
  };
  user: {
    id: string;
  };
  signatures?: string[];
}

interface TellerConnect {
  setup: (config: {
    applicationId: string;
    environment: string;
    products: string[];
    onSuccess: (enrollment: TellerEnrollment) => void;
    onExit: () => void;
    onInit?: () => void;
  }) => {
    open: () => void;
  };
}

declare global {
  interface Window {
    TellerConnect?: TellerConnect;
  }
}

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transportConfig: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const [tellerSessionToken, setTellerSessionToken] = React.useState<string | null>(null);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utils = (trpc as any).useUtils();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveApiKeyMutation = (trpc as any).apps.saveApiKey.useMutation({
    onSuccess: () => {
      utils.apps.getAvailableServers.invalidate();
      utils.timeline.getTimeline.invalidate();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveTellerTokenMutation = (trpc as any).apps.saveTellerToken.useMutation({
    onSuccess: () => {
      utils.apps.getAvailableServers.invalidate();
      utils.timeline.getTimeline.invalidate();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectChromeMutation = (trpc as any).apps.connectChrome.useMutation({
    onSuccess: () => {
      utils.apps.getAvailableServers.invalidate();
      utils.timeline.getTimeline.invalidate();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectBraveMutation = (trpc as any).apps.connectBrave.useMutation({
    onSuccess: () => {
      utils.apps.getAvailableServers.invalidate();
      utils.timeline.getTimeline.invalidate();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCredentialsQuery = (trpc as any).apps.getCredentials.useQuery(
    { connectionId: app?.connection?.id || "" },
    { enabled: false } // Don't auto-fetch, only fetch on demand
  );

  const connectionType = app?.connectionType || "mcp";
  const isMcp = connectionType === "mcp";
  const isApi = connectionType === "api";
  const isFile = connectionType === "file";
  const isChrome = app?.id === "chrome" || app?.name.toLowerCase().includes("chrome");
  const isBrave = app?.id === "brave" || app?.name.toLowerCase().includes("brave");
  const isTeller = app?.id === "teller" || app?.name.toLowerCase().includes("teller");
  const requiresOAuth = app?.oauth === true;
  const isConnected = app?.connection?.status === "connected";
  const connection = app?.connection;
  const isFarcaster = app?.id === "farcaster" || app?.name.toLowerCase().includes("farcaster");


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
      setTellerSessionToken(null);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      // Force cleanup - ensure dialog overlay is removed
      // Small delay to ensure Radix UI cleanup completes
      setTimeout(() => {
        // Remove any lingering overlays
        const overlays = document.querySelectorAll('[data-slot="dialog-overlay"]');
        overlays.forEach((overlay) => {
          if (!overlay.closest('[data-state="open"]')) {
            overlay.remove();
          }
        });
      }, 100);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isFile, isChrome]);

  React.useEffect(() => {
    if (open && isFile && isBrave && !bravePath && !detectingBravePath) {
      if (window.braveHistory && typeof window.braveHistory.detectHistoryPath === "function") {
        handleDetectBravePath();
      } else {
        setBravePath("~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isFile, isBrave]);

  // Ensure dialog closes properly and cleanup overlay
  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Reset all state when closing
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
      setTellerSessionToken(null);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      // Force cleanup of any lingering overlays after a short delay
      setTimeout(() => {
        const overlays = document.querySelectorAll('[data-slot="dialog-overlay"]');
        overlays.forEach((overlay) => {
          const dialog = overlay.closest('[data-state]');
          if (!dialog || dialog.getAttribute('data-state') !== 'open') {
            overlay.remove();
          }
        });
      }, 200);
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to detect Chrome path. You can enter it manually.";
      setError(errorMessage);
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
        handleOpenChange(false);
      }, 1500);
    } catch (err) {
      console.error("Error connecting Chrome:", err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (err as any)?.data?.message || (err instanceof Error ? err.message : String(err)) || "Failed to connect Chrome";
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to detect Brave path. You can enter it manually.";
      setError(errorMessage);
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
        handleOpenChange(false);
      }, 1500);
    } catch (err) {
      console.error("Error connecting Brave:", err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (err as any)?.data?.message || (err instanceof Error ? err.message : String(err)) || "Failed to connect Brave";
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load credentials";
      setError(errorMessage);
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
        handleOpenChange(false);
      }, 1500);
    } catch (err) {
      console.error("Error saving API key:", err);
      // Handle tRPC errors - they might have a different structure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (err as any)?.data?.message || (err instanceof Error ? err.message : String(err)) || "Failed to save API key";
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
      // Generic OAuth flow for apps
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initiate OAuth flow";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Teller completion (from deep link or polling)
  const handleTellerCompletion = React.useCallback(async (data: DeepLinkCallbackData) => {
    if (!data.success || !data.accessToken) {
      setError(data.error || "Failed to connect account");
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsSubmitting(false);
      return;
    }

    try {
      // Save the access token to the backend
      await saveTellerTokenMutation.mutateAsync({
        appId: app?.id || "",
        accessToken: data.accessToken,
        enrollmentId: data.enrollmentId || undefined,
        institutionName: data.institutionName || undefined,
      });

      setSuccess(true);
      setError(null);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsSubmitting(false);

      // Invalidate queries to refresh data
      utils.apps.getAvailableServers.invalidate();
      utils.timeline.getTimeline.invalidate();

      // Close dialog after a delay
      setTimeout(() => {
        handleOpenChange(false);
      }, 2000);
    } catch (err) {
      console.error("Error completing Teller connection:", err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (err as any)?.data?.message || (err instanceof Error ? err.message : "Failed to save connection");
      setError(errorMessage);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsSubmitting(false);
    }
  }, [app, saveTellerTokenMutation, handleOpenChange, utils]);

  // Set up deep link listener for Teller
  React.useEffect(() => {
    if (!open || !isTeller || !tellerSessionToken) return;

    const cleanup = setupDeepLinkListener((data: DeepLinkCallbackData) => {
      if (data.sessionToken === tellerSessionToken && data.accessToken) {
        handleTellerCompletion(data);
      }
    });

    return cleanup;
  }, [open, isTeller, tellerSessionToken, handleTellerCompletion]);

  // Cleanup polling on unmount or dialog close
  React.useEffect(() => {
    if (!open) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [open]);

  const handleTellerConnect = async () => {
    if (!app) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Check if electronWindow is available
      if (!window.electronWindow || typeof window.electronWindow.openExternal !== "function") {
        throw new Error("External browser access not available. Please ensure you're running in Electron.");
      }

      // Generate session token
      const sessionToken = `teller_${Math.random().toString(36).substring(2)}_${Date.now().toString(36)}`;
      setTellerSessionToken(sessionToken);

      // Get server URL
      const serverUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const connectUrl = `${serverUrl}/teller/connect?token=${sessionToken}`;

      // Open external browser
      await window.electronWindow.openExternal(connectUrl);

      // Start polling as fallback (in case deep link doesn't work)
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const statusUrl = `${serverUrl}/teller/status/${sessionToken}`;
          const response = await fetch(statusUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.status === "completed" && data.accessToken) {
              // Clear polling
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              // Handle completion
              await handleTellerCompletion({
                success: true,
                sessionToken: sessionToken,
                accessToken: data.accessToken,
                enrollmentId: data.enrollmentId,
                institutionName: data.institutionName,
                accountIds: [],
                customerId: null,
                error: null,
              });
            } else if (data.status === "error") {
              // Clear polling
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              setError(data.error || "Connection failed");
              setIsSubmitting(false);
            }
          }
        } catch (pollError) {
          console.error("Error polling Teller status:", pollError);
        }
      }, 2000); // Poll every 2 seconds

      // Stop polling after 5 minutes
      setTimeout(() => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          if (!success) {
            setError("Connection timed out. Please try again.");
            setIsSubmitting(false);
          }
        }
      }, 5 * 60 * 1000);
    } catch (err) {
      console.error("Error initiating Teller Connect:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to open browser for Teller connection";
      setError(errorMessage);
      setIsSubmitting(false);
      setTellerSessionToken(null);
    }
  };

  if (!app) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

              {isTeller ? (
            // Teller Connect OAuth Flow
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your bank accounts securely through Teller. You'll be guided through selecting your bank and authenticating.
              </p>
              <Button
                onClick={handleTellerConnect}
                disabled={isSubmitting || success}
                className="w-full"
              >
                {isSubmitting ? "Connecting..." : success ? "Connected!" : "Connect Bank Account"}
              </Button>
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

