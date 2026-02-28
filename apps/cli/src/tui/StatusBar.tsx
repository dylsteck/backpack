import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  itemCount: number;
  activeFilter: string;
  message?: string;
}

export function StatusBar({ itemCount, activeFilter, message }: StatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
      justifyContent="space-between"
    >
      <Text dimColor>
        {itemCount} items
        {activeFilter !== "all" ? ` (${activeFilter})` : ""}
      </Text>
      {message && <Text color="yellow">{message}</Text>}
    </Box>
  );
}
