import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { getDatabase, timelineItems } from "@cortex/core";

const SOURCE_ICONS: Record<string, string> = {
  obsidian: "📄",
  farcaster: "💬",
  teller: "💰",
  chrome: "🌐",
  brave: "🌐",
  manual: "📌",
};

function getSourceIcon(source: string): string {
  return SOURCE_ICONS[source] ?? "📄";
}

function truncate(text: string, max: number): string {
  if (!text) return "Untitled";
  return text.length <= max ? text : text.slice(0, max - 3) + "...";
}

interface AppProps {
  db: ReturnType<typeof getDatabase>;
  config: unknown;
}

export function App({ db }: AppProps) {
  const { exit } = useApp();
  const [items, setItems] = useState<Array<{ id: string; source: string; title?: string; content?: string; timestamp: number }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  React.useEffect(() => {
    db.query.timelineItems
      .findMany({
        orderBy: (items, { desc }) => [desc(items.timestamp)],
        limit: 50,
      })
      .then((rows) => {
        setItems(rows as typeof items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [db]);

  useInput((input, key) => {
    if (input === "q") {
      exit();
    }
    if (viewMode === "detail") {
      if (key.escape) setViewMode("list");
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    }
    if (key.return && items[selectedIndex]) {
      setViewMode("detail");
    }
  });

  if (loading) {
    return (
      <Box>
        <Text>Loading timeline...</Text>
      </Box>
    );
  }

  if (viewMode === "detail" && items[selectedIndex]) {
    const item = items[selectedIndex];
    const content = item.content || item.title || "No content";
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>{item.title || "Untitled"}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>
            {item.source} • {new Date(item.timestamp).toLocaleString()}
          </Text>
        </Box>
        <Box borderStyle="single" padding={1}>
          <Text>{content.slice(0, 500)}{content.length > 500 ? "..." : ""}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>↑/↓ Navigate • Enter View • Esc Back • q Quit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" height="100%">
      <Box flexDirection="column" width="60%">
        <Box marginBottom={1}>
          <Text bold underline>
            Timeline
          </Text>
        </Box>
        {items.map((item, i) => (
          <Box key={item.id}>
            <Text backgroundColor={i === selectedIndex ? "blue" : undefined}>
              {i === selectedIndex ? ">" : " "} {getSourceIcon(item.source)} {truncate(item.title || item.content || "Untitled", 50)}{" "}
              <Text dimColor>{new Date(item.timestamp).toLocaleDateString()}</Text>
            </Text>
          </Box>
        ))}
      </Box>
      <Box width="40%" borderStyle="single" padding={1}>
        <Text dimColor>
          {items.length} items
          {"\n\n"}
          Controls:
          {"\n"}
          ↑/↓ Navigate
          {"\n"}
          Enter View
          {"\n"}
          q Quit
        </Text>
      </Box>
    </Box>
  );
}
