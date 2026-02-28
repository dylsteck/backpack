import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  mode: string;
}

export function Header({ mode }: HeaderProps) {
  return (
    <Box
      borderStyle="single"
      borderBottom={true}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
    >
      <Text bold color="blue">Backpack</Text>
      <Text dimColor> │ </Text>
      <Text color="cyan">{mode}</Text>
    </Box>
  );
}
