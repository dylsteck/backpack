const SOURCE_ICONS: Record<string, string> = {
  obsidian: "📄",
  farcaster: "💬",
  teller: "💰",
  chrome: "🌐",
  brave: "🦁",
  safari: "🌐",
  manual: "📌",
};

// ANSI color codes for source labels
const SOURCE_COLORS: Record<string, string> = {
  obsidian: "\x1b[32m",   // green
  farcaster: "\x1b[35m",  // purple/magenta
  teller: "\x1b[33m",     // yellow
  chrome: "\x1b[34m",     // blue
  brave: "\x1b[91m",      // bright red/orange
  safari: "\x1b[34m",     // blue
  manual: "\x1b[90m",     // gray
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

export function getSourceIcon(source: string): string {
  return SOURCE_ICONS[source] ?? "📄";
}

export function getSourceColor(source: string): string {
  return SOURCE_COLORS[source] ?? "\x1b[90m";
}

export function colorSource(source: string): string {
  const color = getSourceColor(source);
  return `${color}${source}${RESET}`;
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
  showSource?: boolean;
}

export function formatItem(
  item: { source: string; title?: string | null; content?: string | null; timestamp: number | Date },
  options?: FormatItemOptions
): string {
  const icon = getSourceIcon(item.source);
  const maxLen = options?.maxTitleLength ?? getTerminalWidth() - 40;
  const title = truncate(item.title || item.content || "Untitled", maxLen);
  const date = `${DIM}${formatDate(item.timestamp)}${RESET}`;
  const sourcePad = item.source.padEnd(10);
  const sourceStr = options?.showSource !== false
    ? `${getSourceColor(item.source)}${sourcePad}${RESET} `
    : "";
  return `${icon} ${sourceStr}${title}  ${date}`;
}

export function formatItemJson(item: Record<string, unknown>): Record<string, unknown> {
  const { rawData, ...rest } = item;
  return {
    ...rest,
    rawData: typeof rawData === "string" ? (() => { try { return JSON.parse(rawData); } catch { return rawData; } })() : rawData,
  };
}

/** Box-drawing header */
export function formatHeader(text: string): string {
  const width = Math.min(getTerminalWidth(), 60);
  const line = "─".repeat(width);
  return `${DIM}${line}${RESET}\n${BOLD} ${text}${RESET}\n${DIM}${line}${RESET}`;
}

/** Simple table formatter */
export function formatTable(
  rows: string[][],
  columns: { header: string; width?: number }[]
): string {
  const widths = columns.map((col, i) => {
    const maxContent = Math.max(col.header.length, ...rows.map((r) => (r[i] ?? "").length));
    return col.width ?? Math.min(maxContent + 2, 40);
  });

  const headerLine = columns.map((col, i) => `${BOLD}${col.header.padEnd(widths[i])}${RESET}`).join(" ");
  const separator = widths.map((w) => `${DIM}${"─".repeat(w)}${RESET}`).join(" ");
  const dataLines = rows.map((row) =>
    row.map((cell, i) => cell.padEnd(widths[i])).join(" ")
  );

  return [headerLine, separator, ...dataLines].join("\n");
}

/** Format sync result line */
export function formatSyncResult(source: string, added: number, updated: number, durationMs: number): string {
  const icon = getSourceIcon(source);
  const color = getSourceColor(source);
  const name = source.padEnd(12);
  const stats = `${added} new, ${updated} updated`;
  const time = `${(durationMs / 1000).toFixed(1)}s`;
  return `  ${GREEN}✓${RESET} ${icon} ${color}${name}${RESET} ${stats.padEnd(22)} ${DIM}${time}${RESET}`;
}

export function formatSyncError(source: string, error: string): string {
  const icon = getSourceIcon(source);
  const color = getSourceColor(source);
  const name = source.padEnd(12);
  return `  ${RED}✗${RESET} ${icon} ${color}${name}${RESET} ${RED}${error}${RESET}`;
}
