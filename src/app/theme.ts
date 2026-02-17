export const colors = {
  bg: "#0a0a0a",
  surface: "#141414",
  surfaceHover: "#1a1a1a",
  border: "#2a2a2a",
  text: "#f1efe8",
  textMuted: "#8a8880",
  textDim: "#555550",
  accent: "oklch(69.4% 0.202 41.8)",
  accentHover: "oklch(77% 0.202 41.8)",
  secondary: "oklch(56.5% 0.196 256.5)",
  secondaryHover: "oklch(64% 0.196 256.5)",
  success: "#4ade80",
  warning: "#fbbf24",
  error: "#f87171",
  codeBackground: "#111111",
  codeLine: "#1e1e1e",
  codeLineHighlight: "#252525",
} as const;

export const fonts = {
  code: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
} as const;

export const fontSizes = {
  codeSmall: "14px",
  code: "16px",
  codeLarge: "18px",
  body: "16px",
  heading: "24px",
  title: "32px",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "12px",
} as const;

export const durations = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
} as const;

// Spring for position/layout — gentle deceleration, no bounce
export const spring = {
  type: "spring" as const,
  stiffness: 120,
  damping: 20,
  mass: 1,
};

// Soft tween for opacity/color — quick ease-out
export const fade = {
  duration: 0.25,
  ease: "easeOut" as const,
};
