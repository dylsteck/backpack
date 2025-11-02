import * as React from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/tailwind";

function ImageWithFallback({
  src,
  alt,
  className,
  fallbackText,
  containerClassName,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackText: string;
  containerClassName?: string;
}) {
  const [hasError, setHasError] = React.useState(false);

  if (!src || hasError) {
    return (
      <div className={cn("flex items-center justify-center rounded bg-muted-foreground/20 text-muted-foreground text-xs font-semibold", className, containerClassName)}>
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

interface ViewToggleProps {
  data: any[];
  renderGalleryCard?: (item: any) => React.ReactNode;
  getIconUrl?: (item: any) => string | undefined;
  getName?: (item: any) => string;
  getFields?: (item: any) => Record<string, any>;
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  title?: string;
  onSetupClick?: (item: any) => void;
}

export function ViewToggle({
  data,
  renderGalleryCard,
  getIconUrl = (item) => item.iconUrl,
  getName = (item) => item.name || item.title || String(item.id || ""),
  getFields = (item) => item,
  isLoading = false,
  error = null,
  emptyMessage = "No items available",
  title,
  onSetupClick,
}: ViewToggleProps) {

  if (error) {
    return (
      <div className="flex flex-col w-full items-center justify-center px-6 py-12">
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
        Error: {error.message}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col w-full">
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <div className="px-4 pb-4">
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center min-h-[200px]">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {data.map((item, index) => {
            if (renderGalleryCard) {
              return <React.Fragment key={index}>{renderGalleryCard(item)}</React.Fragment>;
            }

            const iconUrl = getIconUrl(item);
            const name = getName(item);
            const itemId = item.id ?? index;
            const isConnected = item.connection && item.connection.status === "connected";

            return (
              <div
                key={itemId}
                onClick={() => {
                  if (isConnected && onSetupClick) {
                    onSetupClick(item);
                  }
                }}
                className={cn(
                  "group relative flex flex-col rounded-lg border bg-card p-4 transition-all hover:shadow-lg",
                  isConnected && onSetupClick ? "cursor-pointer hover:border-primary/50" : "hover:border-primary/50"
                )}
              >
                {!isConnected && onSetupClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetupClick(item);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent hover:border-primary/50 z-10"
                    aria-label={`Setup ${name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                {isConnected && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="default" className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white border-0">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-start shrink-0 mb-3">
                  <ImageWithFallback
                    src={iconUrl}
                    alt={name}
                    className="h-10 w-10 rounded-lg object-contain"
                    fallbackText={name}
                  />
                </div>
                <h3 className="text-base font-normal text-left">{name}</h3>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

