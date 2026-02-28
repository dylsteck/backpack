import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { getDatabase, getConfig, setConfig, initSyncers } from "@backpack/core";

const BANNER = `
  ____             _                    _
 | __ )  __ _  ___| | ___ __   __ _  ___| | __
 |  _ \\ / _\` |/ __| |/ / '_ \\ / _\` |/ __| |/ /
 | |_) | (_| | (__|   <| |_) | (_| | (__|   <
 |____/ \\__,_|\\___|_|\\_\\ .__/ \\__,_|\\___|_|\\_\\
                        |_|
`;

interface Source {
  id: string;
  name: string;
  icon: string;
  selected: boolean;
  configFields?: Array<{ key: string; label: string; value: string }>;
}

type Step = "welcome" | "select" | "configure" | "sync" | "done";

interface InitWizardProps {
  db: ReturnType<typeof getDatabase>;
  config: ReturnType<typeof getConfig>;
}

export function InitWizard({ db, config }: InitWizardProps) {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>("welcome");
  const [sources, setSources] = useState<Source[]>([
    { id: "obsidian", name: "Obsidian", icon: "📄", selected: false, configFields: [{ key: "vaultPath", label: "Vault path", value: "" }] },
    { id: "farcaster", name: "Farcaster", icon: "💬", selected: false, configFields: [{ key: "neynarApiKey", label: "Neynar API key", value: "" }, { key: "fid", label: "FID", value: "" }] },
    { id: "chrome", name: "Chrome", icon: "🌐", selected: false },
    { id: "brave", name: "Brave", icon: "🦁", selected: false },
    { id: "teller", name: "Teller", icon: "💰", selected: false },
  ]);
  const [cursor, setCursor] = useState(0);
  const [configSourceIndex, setConfigSourceIndex] = useState(0);
  const [configFieldIndex, setConfigFieldIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [syncResults, setSyncResults] = useState<Array<{ source: string; status: string; count: number }>>([]);
  const [syncing, setSyncing] = useState(false);

  const selectedSources = sources.filter((s) => s.selected);

  // Sources that need configuration
  const configurableSources = selectedSources.filter(
    (s) => s.configFields && s.configFields.length > 0
  );

  useInput((input, key) => {
    if (input === "q" && step !== "configure") {
      exit();
      return;
    }

    switch (step) {
      case "welcome":
        if (key.return) setStep("select");
        break;

      case "select":
        if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
        if (key.downArrow) setCursor((c) => Math.min(sources.length - 1, c + 1));
        if (input === " ") {
          setSources((prev) =>
            prev.map((s, i) => (i === cursor ? { ...s, selected: !s.selected } : s))
          );
        }
        if (key.return && selectedSources.length > 0) {
          if (configurableSources.length > 0) {
            setConfigSourceIndex(0);
            setConfigFieldIndex(0);
            const field = configurableSources[0]?.configFields?.[0];
            setInputValue(field?.value ?? "");
            setStep("configure");
          } else {
            setStep("sync");
          }
        }
        break;

      case "configure":
        if (key.return) {
          // Save current field value
          const currentSource = configurableSources[configSourceIndex];
          if (currentSource?.configFields) {
            const updatedSources = sources.map((s) => {
              if (s.id === currentSource.id && s.configFields) {
                const updatedFields = s.configFields.map((f, i) =>
                  i === configFieldIndex ? { ...f, value: inputValue } : f
                );
                return { ...s, configFields: updatedFields };
              }
              return s;
            });
            setSources(updatedSources);

            // Move to next field or next source
            const nextFieldIndex = configFieldIndex + 1;
            if (nextFieldIndex < (currentSource.configFields?.length ?? 0)) {
              setConfigFieldIndex(nextFieldIndex);
              setInputValue(currentSource.configFields[nextFieldIndex]?.value ?? "");
            } else {
              const nextSourceIndex = configSourceIndex + 1;
              if (nextSourceIndex < configurableSources.length) {
                setConfigSourceIndex(nextSourceIndex);
                setConfigFieldIndex(0);
                const nextSource = configurableSources[nextSourceIndex];
                setInputValue(nextSource?.configFields?.[0]?.value ?? "");
              } else {
                setStep("sync");
              }
            }
          }
        }
        if (key.backspace || key.delete) {
          setInputValue((v) => v.slice(0, -1));
        } else if (!key.return && !key.escape && !key.upArrow && !key.downArrow && input) {
          setInputValue((v) => v + input);
        }
        break;

      case "sync":
        // Auto-starts
        break;

      case "done":
        if (key.return || input === "q") exit();
        break;
    }
  });

  // Auto-start sync
  useEffect(() => {
    if (step !== "sync" || syncing) return;
    setSyncing(true);

    (async () => {
      // Save config
      const sourceConfig: Record<string, { type: string; enabled: boolean; config: Record<string, unknown> }> = {};
      for (const source of selectedSources) {
        const cfg: Record<string, unknown> = {};
        if (source.configFields) {
          for (const field of source.configFields) {
            if (field.value) {
              if (field.key === "fid") {
                cfg[field.key] = parseInt(field.value, 10) || 0;
              } else {
                cfg[field.key] = field.value;
              }
            }
          }
        }
        sourceConfig[source.id] = { type: source.id, enabled: true, config: cfg };
      }

      try {
        setConfig({ sources: sourceConfig as any });
      } catch {
        // Config may already be set
      }

      // Run sync
      try {
        const updatedConfig = getConfig();
        const manager = initSyncers(db, updatedConfig);
        const syncSources = selectedSources
          .filter((s) => s.id !== "teller")
          .map((s) => s.id) as any;

        const result = await manager.syncAll({
          sources: syncSources.length > 0 ? syncSources : undefined,
          onProgress: (progress) => {
            setSyncResults((prev) => {
              const existing = prev.findIndex((r) => r.source === progress.source);
              const entry = { source: progress.source, status: progress.status, count: progress.itemsAdded };
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = entry;
                return updated;
              }
              return [...prev, entry];
            });
          },
        });

        // Add final results
        const finalResults: typeof syncResults = [];
        for (const [source, progress] of Object.entries(result.sourceResults)) {
          if (progress) {
            finalResults.push({ source, status: "done", count: progress.itemsAdded });
          }
        }
        if (finalResults.length > 0) setSyncResults(finalResults);
      } catch {
        // Sync errors are shown in results
      }

      setStep("done");
    })();
  }, [step]);

  if (step === "welcome") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="blue">{BANNER}</Text>
        <Text>Your personal data aggregator and timeline.</Text>
        <Box marginTop={1}>
          <Text dimColor>Press </Text>
          <Text bold color="cyan">Enter</Text>
          <Text dimColor> to get started</Text>
        </Box>
      </Box>
    );
  }

  if (step === "select") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Select sources to connect:</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Use ↑↓ to navigate, Space to toggle, Enter to confirm</Text>
        </Box>
        {sources.map((source, i) => (
          <Box key={source.id}>
            <Text color={i === cursor ? "cyan" : undefined}>
              {i === cursor ? "❯ " : "  "}
              {source.selected ? "[✓]" : "[ ]"} {source.icon} {source.name}
            </Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>
            {selectedSources.length} selected
            {selectedSources.length > 0 ? " — press Enter to continue" : ""}
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === "configure") {
    const currentSource = configurableSources[configSourceIndex];
    const currentField = currentSource?.configFields?.[configFieldIndex];

    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Configure {currentSource?.icon} {currentSource?.name}</Text>
          <Text dimColor> ({configSourceIndex + 1}/{configurableSources.length})</Text>
        </Box>
        <Box marginBottom={1}>
          <Text>{currentField?.label}: </Text>
        </Box>
        <Box>
          <Text color="cyan">❯ </Text>
          <Text>{inputValue}</Text>
          <Text color="cyan">█</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Enter to confirm</Text>
        </Box>
      </Box>
    );
  }

  if (step === "sync") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Syncing sources...</Text>
        </Box>
        {syncResults.map((r) => (
          <Box key={r.source}>
            <Text>
              {r.status === "done" ? (
                <Text color="green">✓ </Text>
              ) : (
                <Text color="yellow">⟳ </Text>
              )}
              <Text>{getSourceIcon(r.source)} </Text>
              <Text>{r.source.padEnd(12)} </Text>
              <Text dimColor>{r.count} items</Text>
            </Text>
          </Box>
        ))}
        {selectedSources.some((s) => s.id === "teller") && (
          <Box marginTop={1}>
            <Text dimColor>Note: Teller requires OAuth setup via the web UI</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Done
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">✓ Setup complete!</Text>
      </Box>
      <Text>Connected sources:</Text>
      {syncResults.map((r) => (
        <Box key={r.source}>
          <Text>  {getSourceIcon(r.source)} {r.source}: {r.count} items synced</Text>
        </Box>
      ))}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Quick commands:</Text>
        <Text dimColor>  backpack timeline    View your timeline</Text>
        <Text dimColor>  backpack sync        Sync latest data</Text>
        <Text dimColor>  backpack search      Search your data</Text>
        <Text dimColor>  backpack tui         Launch interactive TUI</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Enter or q to exit</Text>
      </Box>
    </Box>
  );
}

function getSourceIcon(source: string): string {
  const icons: Record<string, string> = {
    obsidian: "📄", farcaster: "💬", teller: "💰", chrome: "🌐", brave: "🦁",
  };
  return icons[source] ?? "📄";
}
