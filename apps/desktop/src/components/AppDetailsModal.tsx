import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/utils/tailwind";

interface AppDetailsSidebarProps {
  app: {
    id: string;
    name: string;
    description: string;
    transport: string[] | null;
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

export function AppDetailsSidebar({ app, open, onOpenChange }: AppDetailsSidebarProps) {
  if (!app) return null;

  const connectionType = app.connectionType || "mcp";
  const isMcp = connectionType === "mcp";
  const isApi = connectionType === "api";

  // Determine config type
  const hasUrl = !!app.config?.url;
  const hasCommand = !!app.config?.command;
  const isUrlBased = hasUrl && !hasCommand;
  const isCommandBased = hasCommand;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-6">
          <div className="flex items-start gap-4">
            <ImageWithFallback
              src={app.iconUrl}
              alt={app.name}
              className="h-16 w-16 rounded-xl object-contain shrink-0 border"
              fallbackText={app.name}
            />
            <div className="flex-1 min-w-0 pt-1">
              <SheetTitle className="text-2xl font-bold mb-3">{app.name}</SheetTitle>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant={isMcp ? "default" : "secondary"}>
                  {connectionType.toUpperCase()}
                </Badge>
                {app.oauth && (
                  <Badge variant="outline">OAuth</Badge>
                )}
              </div>
              <SheetDescription className="text-sm text-muted-foreground leading-relaxed">
                {app.description}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Transport Types (MCP only) */}
          {isMcp && app.transport && app.transport.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Transport Types</h3>
              <div className="flex flex-wrap gap-2">
                {app.transport.map((type) => (
                  <Badge key={type} variant="secondary" className="font-mono text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {(isMcp && app.transport && app.transport.length > 0) && <Separator />}

          {/* Configuration Details */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Configuration</h3>
            <div className="space-y-4">
              {isUrlBased && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">URL</label>
                    <div className="p-3 rounded-lg bg-muted/50 border font-mono text-xs break-all">
                      {app.config.url}
                    </div>
                  </div>
                  {app.config.headers && Object.keys(app.config.headers).length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">Headers</label>
                      <div className="p-3 rounded-lg bg-muted/50 border font-mono text-xs overflow-x-auto">
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(app.config.headers, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isCommandBased && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Command</label>
                    <div className="p-3 rounded-lg bg-muted/50 border font-mono text-xs">
                      {app.config.command}
                    </div>
                  </div>
                  {app.config.args && app.config.args.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">Arguments</label>
                      <div className="p-3 rounded-lg bg-muted/50 border font-mono text-xs">
                        {app.config.args.join(" ")}
                      </div>
                    </div>
                  )}
                  {app.config.env && Object.keys(app.config.env).length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">Environment Variables</label>
                      <div className="p-3 rounded-lg bg-muted/50 border font-mono text-xs overflow-x-auto">
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(app.config.env, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isApi && (
                <div className="space-y-4">
                  {app.config.url && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">API URL</label>
                      <div className="p-3 rounded-lg bg-muted/50 border font-mono text-xs break-all">
                        {app.config.url}
                      </div>
                    </div>
                  )}
                  {app.config.oas && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">OpenAPI Spec</label>
                      <div className="p-3 rounded-lg bg-muted/50 border font-mono text-xs break-all">
                        {app.config.oas}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback: show raw config if structure doesn't match expected patterns */}
              {!isUrlBased && !isCommandBased && !isApi && app.config && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Config</label>
                  <div className="p-3 rounded-lg bg-muted/50 border font-mono text-xs overflow-x-auto">
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(app.config, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* App ID */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">App ID</label>
            <div className="p-3 rounded-lg bg-muted/50 border font-mono text-xs">
              {app.id}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

