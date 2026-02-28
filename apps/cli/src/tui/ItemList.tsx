import React from "react";
import { Box, Text } from "ink";

const SOURCE_ICONS: Record<string, string> = {
  obsidian: "📄",
  farcaster: "💬",
  teller: "💰",
  chrome: "🌐",
  brave: "🦁",
  manual: "📌",
};

const SOURCE_COLORS: Record<string, string> = {
  obsidian: "green",
  farcaster: "magenta",
  teller: "yellow",
  chrome: "blue",
  brave: "red",
  manual: "gray",
};

interface Item {
  id: string;
  source: string;
  title?: string;
  content?: string;
  timestamp: number;
}

interface ItemListProps {
  items: Item[];
  selectedIndex: number;
  scrollOffset: number;
  maxVisible: number;
}

function truncate(text: string, max: number): string {
  if (!text) return "Untitled";
  return text.length <= max ? text : text.slice(0, max - 3) + "...";
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ItemList({ items, selectedIndex, scrollOffset, maxVisible }: ItemListProps) {
  const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisible);

  if (items.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} padding={2}>
        <Text>No items to display</Text>
        <Text dimColor>Press 's' to sync or connect a source first</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleItems.map((item, i) => {
        const actualIndex = scrollOffset + i;
        const isSelected = actualIndex === selectedIndex;
        const icon = SOURCE_ICONS[item.source] ?? "📄";
        const color = SOURCE_COLORS[item.source] as any ?? "white";
        const title = truncate(item.title || item.content || "Untitled", 50);
        const date = formatRelativeDate(item.timestamp);

        return (
          <Box key={item.id}>
            <Text inverse={isSelected}>
              {isSelected ? "❯" : " "}{" "}
              <Text color={color}>{icon}</Text>{" "}
              {title}
              {"  "}
              <Text dimColor>{date}</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
