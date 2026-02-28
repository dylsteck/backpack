import React from "react";
import { Box, Text } from "ink";

const SOURCE_COLORS: Record<string, string> = {
  obsidian: "green",
  farcaster: "magenta",
  teller: "yellow",
  chrome: "blue",
  brave: "red",
  manual: "gray",
};

interface DetailViewProps {
  item: {
    id: string;
    source: string;
    title?: string;
    content?: string;
    timestamp: number;
    type?: string;
    url?: string;
  };
}

export function DetailView({ item }: DetailViewProps) {
  const color = SOURCE_COLORS[item.source] as any ?? "white";
  const content = item.content || item.title || "No content available";
  const date = new Date(item.timestamp).toLocaleString();

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      {/* Metadata bar */}
      <Box marginBottom={1} gap={2}>
        <Text color={color} bold>{item.source}</Text>
        {item.type && <Text dimColor>{item.type}</Text>}
        <Text dimColor>{date}</Text>
      </Box>

      {/* Title */}
      {item.title && (
        <Box marginBottom={1}>
          <Text bold wrap="wrap">{item.title}</Text>
        </Box>
      )}

      {/* Content */}
      <Box borderStyle="round" padding={1} flexGrow={1}>
        <Text wrap="wrap">
          {content.slice(0, 1000)}
          {content.length > 1000 ? "..." : ""}
        </Text>
      </Box>

      {/* URL if available */}
      {item.url && (
        <Box marginTop={1}>
          <Text dimColor>URL: </Text>
          <Text color="cyan">{item.url}</Text>
        </Box>
      )}

      {/* Controls */}
      <Box marginTop={1}>
        <Text dimColor>Esc Back │ q Quit</Text>
      </Box>
    </Box>
  );
}
