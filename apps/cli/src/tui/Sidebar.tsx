import React from "react";
import { Box, Text } from "ink";

const SOURCE_ICONS: Record<string, string> = {
  all: "📋",
  obsidian: "📄",
  farcaster: "💬",
  teller: "💰",
  chrome: "🌐",
  brave: "🦁",
  manual: "📌",
};

const SOURCE_COLORS: Record<string, string> = {
  all: "white",
  obsidian: "green",
  farcaster: "magenta",
  teller: "yellow",
  chrome: "blue",
  brave: "red",
  manual: "gray",
};

interface SidebarProps {
  sources: Array<{ id: string; count: number }>;
  activeFilter: string;
  cursor: number;
  totalItems: number;
}

export function Sidebar({ sources, activeFilter, cursor, totalItems }: SidebarProps) {
  const allSources = [{ id: "all", count: totalItems }, ...sources];

  return (
    <Box flexDirection="column" width={28} borderStyle="single" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold underline>Sources</Text>
      </Box>
      {allSources.map((source, i) => {
        const isActive = source.id === activeFilter;
        const isCursor = i === cursor;
        const icon = SOURCE_ICONS[source.id] ?? "📄";
        const color = SOURCE_COLORS[source.id] ?? "white";

        return (
          <Box key={source.id}>
            <Text
              color={isActive ? "cyan" : isCursor ? color : undefined}
              bold={isActive}
              inverse={isCursor}
            >
              {isCursor ? "❯" : " "} {icon} {source.id.padEnd(12)} <Text dimColor>{source.count}</Text>
            </Text>
          </Box>
        );
      })}
      <Box flexGrow={1} />
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor bold>Keys</Text>
        <Text dimColor>j/k  Navigate</Text>
        <Text dimColor>f    Filter source</Text>
        <Text dimColor>/    Search</Text>
        <Text dimColor>s    Sync</Text>
        <Text dimColor>?    Help</Text>
        <Text dimColor>q    Quit</Text>
      </Box>
    </Box>
  );
}
