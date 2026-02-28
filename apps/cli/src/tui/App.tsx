import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import { getDatabase, initSyncers } from "@backpack/core";
import { Header } from "./Header.js";
import { Sidebar } from "./Sidebar.js";
import { ItemList } from "./ItemList.js";
import { DetailView } from "./DetailView.js";
import { StatusBar } from "./StatusBar.js";

type TimelineItem = {
  id: string;
  source: string;
  title?: string;
  content?: string;
  timestamp: number;
  type?: string;
  url?: string;
};

interface AppProps {
  db: ReturnType<typeof getDatabase>;
  config: unknown;
}

function groupBySource(items: TimelineItem[]): Array<{ id: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.source] = (counts[item.source] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
}

export function App({ db, config }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sidebarCursor, setSidebarCursor] = useState(0);
  const [filterMode, setFilterMode] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | undefined>();

  const fetchItems = useCallback(async () => {
    const rows = await db.query.timelineItems.findMany({
      orderBy: (items, { desc }) => [desc(items.timestamp)],
      limit: 200,
    });
    setItems(rows as TimelineItem[]);
  }, [db]);

  useEffect(() => {
    fetchItems().finally(() => setLoading(false));
  }, [fetchItems]);

  const sources = groupBySource(items);
  const allSources = [{ id: "all", count: items.length }, ...sources];

  const filteredBySource =
    activeFilter === "all"
      ? items
      : items.filter((i) => i.source === activeFilter);

  const filteredItems = searchQuery.trim()
    ? filteredBySource.filter((item) => {
        const q = searchQuery.toLowerCase();
        const title = (item.title ?? "").toLowerCase();
        const content = (item.content ?? "").toLowerCase();
        return title.includes(q) || content.includes(q);
      })
    : filteredBySource;

  const maxVisible = Math.max(8, (stdout?.rows ?? 24) - 8);
  const clampedIndex = Math.min(selectedIndex, Math.max(0, filteredItems.length - 1));

  useEffect(() => {
    const newOffset = Math.max(
      0,
      Math.min(clampedIndex - maxVisible + 1, clampedIndex)
    );
    setScrollOffset(newOffset);
  }, [clampedIndex, maxVisible]);

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, filteredItems.length - 1)));
  }, [filteredItems.length]);

  useInput(
    (input, key) => {
      if (input === "q" && !searchMode) {
        exit();
        return;
      }

      if (searchMode) {
        if (key.escape) {
          setSearchMode(false);
          setSearchQuery("");
        }
        return;
      }

      if (showHelp) {
        if (input === "?" || key.escape) {
          setShowHelp(false);
        }
        return;
      }

      if (viewMode === "detail") {
        if (key.escape) setViewMode("list");
        return;
      }

      if (filterMode) {
        if (key.escape) {
          setFilterMode(false);
          return;
        }
        if (input === "j" || key.downArrow) {
          setSidebarCursor((c) =>
            Math.min(allSources.length - 1, c + 1)
          );
          return;
        }
        if (input === "k" || key.upArrow) {
          setSidebarCursor((c) => Math.max(0, c - 1));
          return;
        }
        if (key.return) {
          const src = allSources[sidebarCursor];
          setActiveFilter(src?.id ?? "all");
          setFilterMode(false);
          setSelectedIndex(0);
        }
        return;
      }

      if (input === "f") {
        setFilterMode(true);
        setSidebarCursor(allSources.findIndex((s) => s.id === activeFilter));
        return;
      }

      if (input === "/") {
        setSearchMode(true);
        return;
      }

      if (input === "?") {
        setShowHelp(true);
        return;
      }

      if (input === "s") {
        (async () => {
          setSyncMessage("Syncing...");
          try {
            const manager = initSyncers(db, config);
            const result = await manager.syncAll({});
            const total =
              Object.values(result.sourceResults).reduce(
                (sum, p) => sum + (p?.itemsAdded ?? 0) + (p?.itemsUpdated ?? 0),
                0
              );
            await fetchItems();
            setSyncMessage(`Sync complete (${total} items)`);
            setTimeout(() => setSyncMessage(undefined), 3000);
          } catch (err) {
            setSyncMessage(
              `Sync failed: ${err instanceof Error ? err.message : String(err)}`
            );
            setTimeout(() => setSyncMessage(undefined), 3000);
          }
        })();
        return;
      }

      if (input === "j" || key.downArrow) {
        setSelectedIndex((i) =>
          Math.min(filteredItems.length - 1, i + 1)
        );
        return;
      }
      if (input === "k" || key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }

      if (key.return && filteredItems[clampedIndex]) {
        setViewMode("detail");
      }
    }
  );

  if (loading) {
    return (
      <Box padding={2}>
        <Text>Loading timeline...</Text>
      </Box>
    );
  }

  if (showHelp) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text bold color="cyan">
          Backpack TUI - Keyboard Shortcuts
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text>j / ↓    Move down</Text>
          <Text>k / ↑    Move up</Text>
          <Text>Enter    View item / Confirm filter</Text>
          <Text>Esc      Back / Exit filter or search</Text>
          <Text>f        Filter by source</Text>
          <Text>/        Search</Text>
          <Text>s        Sync</Text>
          <Text>?        Toggle help</Text>
          <Text>q        Quit</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ? or Esc to close</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header mode={viewMode === "detail" ? "Detail" : "Timeline"} />

      <Box flexDirection="row" flexGrow={1} minHeight={10}>
        <Sidebar
          sources={sources}
          activeFilter={activeFilter}
          cursor={filterMode ? sidebarCursor : allSources.findIndex((s) => s.id === activeFilter)}
          totalItems={items.length}
        />

        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {searchMode ? (
            <Box marginBottom={1}>
              <Text color="cyan">Search: </Text>
              <TextInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Type to filter..."
                focus={true}
              />
            </Box>
          ) : null}

          {viewMode === "detail" && filteredItems[clampedIndex] ? (
            <DetailView item={filteredItems[clampedIndex]} />
          ) : (
            <ItemList
              items={filteredItems}
              selectedIndex={clampedIndex}
              scrollOffset={scrollOffset}
              maxVisible={maxVisible}
            />
          )}
        </Box>
      </Box>

      <StatusBar
        itemCount={filteredItems.length}
        activeFilter={activeFilter}
        message={syncMessage}
      />
    </Box>
  );
}
