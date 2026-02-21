const SOURCE_ICONS: Record<string, string> = {
  obsidian: "📄",
  farcaster: "💬",
  teller: "💰",
  chrome: "🌐",
  brave: "🌐",
  safari: "🌐",
  manual: "📌",
};

export function getSourceIcon(source: string): string {
  return SOURCE_ICONS[source] ?? "📄";
}

export function formatDate(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (60 * 1000));
      return diffMins <= 1 ? "just now" : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

export function truncate(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function getTerminalWidth(): number {
  return process.stdout.columns ?? 80;
}

export interface FormatItemOptions {
  maxTitleLength?: number;
}

export function formatItem(
  item: { source: string; title?: string | null; content?: string | null; timestamp: number | Date },
  options?: FormatItemOptions
): string {
  const icon = getSourceIcon(item.source);
  const maxLen = options?.maxTitleLength ?? getTerminalWidth() - 30;
  const title = truncate(item.title || item.content || "Untitled", maxLen);
  const date = formatDate(item.timestamp);
  return `${icon} ${title}  ${date}`;
}

export function formatItemJson(item: Record<string, unknown>): Record<string, unknown> {
  const { rawData, ...rest } = item;
  return {
    ...rest,
    rawData: typeof rawData === "string" ? (() => { try { return JSON.parse(rawData); } catch { return rawData; } })() : rawData,
  };
}
