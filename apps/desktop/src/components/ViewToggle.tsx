import * as React from "react";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/tailwind";

type ViewMode = "gallery" | "table";

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
  renderTableRow?: (item: any) => React.ReactNode;
  getIconUrl?: (item: any) => string | undefined;
  getName?: (item: any) => string;
  getFields?: (item: any) => Record<string, any>;
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  title?: string;
}

export function ViewToggle({
  data,
  renderGalleryCard,
  renderTableRow,
  getIconUrl = (item) => item.iconUrl,
  getName = (item) => item.name || item.title || String(item.id || ""),
  getFields = (item) => item,
  isLoading = false,
  error = null,
  emptyMessage = "No items available",
  title,
}: ViewToggleProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("gallery");

  // Get all unique field keys from data for table columns
  const tableColumns = React.useMemo(() => {
    if (data.length === 0) return [];
    const allFields = data.map(getFields);
    const allKeys = new Set<string>();
    allFields.forEach((fields) => {
      Object.keys(fields).forEach((key) => {
        if (key !== "iconUrl" && typeof fields[key] !== "object") {
          allKeys.add(key);
        }
      });
    });
    return Array.from(allKeys);
  }, [data, getFields]);

  const formatCellValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">—</span>;
    }
    
    if (typeof value === "boolean") {
      return (
        <Badge variant={value ? "default" : "outline"}>
          {value ? "Yes" : "No"}
        </Badge>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((item: any, idx: number) => (
            <Badge key={idx} variant="secondary">
              {String(item)}
            </Badge>
          ))}
        </div>
      );
    }

    if (typeof value === "object") {
      return (
        <span className="text-muted-foreground text-xs">
          {JSON.stringify(value)}
        </span>
      );
    }

    return String(value);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
        Error: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {viewMode === "gallery" ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Icon</TableHead>
                  {tableColumns.slice(0, 5).map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-8 w-8 rounded" />
                    </TableCell>
                    {tableColumns.slice(0, 5).map((col) => (
                      <TableCell key={col}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {(title || data.length > 0) && (
        <div className="flex items-center justify-between">
          {title && (
            <h2 className="text-2xl font-semibold">
              {title} {data.length > 0 && `(${data.length})`}
            </h2>
          )}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value) setViewMode(value as ViewMode);
            }}
            variant="outline"
          >
            <ToggleGroupItem value="gallery" aria-label="Gallery view">
              <LayoutGrid className="size-4" />
              <span className="ml-2">Gallery</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view">
              <TableIcon className="size-4" />
              <span className="ml-2">Table</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : viewMode === "gallery" ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {data.map((item, index) => {
            if (renderGalleryCard) {
              return <React.Fragment key={index}>{renderGalleryCard(item)}</React.Fragment>;
            }

            const iconUrl = getIconUrl(item);
            const name = getName(item);
            const itemId = item.id ?? index;

            return (
              <div
                key={itemId}
                className="group relative flex flex-col rounded-lg border bg-card p-4 transition-all hover:shadow-md hover:border-primary/50"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-muted shrink-0">
                  <ImageWithFallback
                    src={iconUrl}
                    alt={name}
                    className="h-10 w-10 rounded-lg object-contain"
                    fallbackText={name}
                  />
                </div>
                <h3 className="text-sm font-semibold">{name}</h3>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Icon</TableHead>
                <TableHead>Name</TableHead>
                {tableColumns.map((col) => (
                  <TableHead key={col} className="capitalize">
                    {col.replace(/([A-Z])/g, " $1").trim()}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => {
                if (renderTableRow) {
                  return <React.Fragment key={index}>{renderTableRow(item)}</React.Fragment>;
                }

                const iconUrl = getIconUrl(item);
                const name = getName(item);
                const fields = getFields(item);
                const itemId = item.id ?? index;

                return (
                  <TableRow key={itemId}>
                    <TableCell>
                      <ImageWithFallback
                        src={iconUrl}
                        alt={name}
                        className="h-8 w-8 rounded object-contain"
                        fallbackText={name}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{name}</TableCell>
                    {tableColumns.map((col) => (
                      <TableCell key={col}>{formatCellValue(fields[col])}</TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

