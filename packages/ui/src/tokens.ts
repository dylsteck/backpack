/** Design tokens – Linear-inspired dark palette */

export const colors = {
  bg: {
    primary: "#0a0a0f",
    secondary: "#12121a",
    tertiary: "#1a1a25",
  },
  border: {
    subtle: "#1e1e2e",
    medium: "#2a2a3a",
    focus: "#4f46e5",
  },
  text: {
    primary: "#e4e4ed",
    secondary: "#8b8ba0",
    tertiary: "#5a5a70",
  },
  accent: {
    primary: "#4f46e5",
    link: "#818cf8",
  },
  source: {
    farcaster: "#a855f7",
    obsidian: "#10b981",
    chrome: "#3b82f6",
    brave: "#f97316",
    teller: "#f59e0b",
    safari: "#3b82f6",
    manual: "#8b8ba0",
  },
} as const;

/** Tailwind class-string helpers so JIT picks up the values */
export const bg = {
  primary: "bg-[#0a0a0f]",
  secondary: "bg-[#12121a]",
  tertiary: "bg-[#1a1a25]",
} as const;

export const border = {
  subtle: "border-[#1e1e2e]",
  medium: "border-[#2a2a3a]",
  focus: "border-[#4f46e5]",
} as const;

export const text = {
  primary: "text-[#e4e4ed]",
  secondary: "text-[#8b8ba0]",
  tertiary: "text-[#5a5a70]",
} as const;

export const accent = {
  primary: "bg-[#4f46e5]",
  primaryHover: "hover:bg-[#4338ca]",
  link: "text-[#818cf8]",
} as const;

export const sourceColor: Record<string, string> = {
  farcaster: "bg-[#a855f7]",
  obsidian: "bg-[#10b981]",
  chrome: "bg-[#3b82f6]",
  brave: "bg-[#f97316]",
  teller: "bg-[#f59e0b]",
  safari: "bg-[#3b82f6]",
  manual: "bg-[#8b8ba0]",
};

export const sourceBorder: Record<string, string> = {
  farcaster: "border-[#a855f7]",
  obsidian: "border-[#10b981]",
  chrome: "border-[#3b82f6]",
  brave: "border-[#f97316]",
  teller: "border-[#f59e0b]",
  safari: "border-[#3b82f6]",
  manual: "border-[#8b8ba0]",
};
