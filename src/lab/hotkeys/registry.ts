// Hotkey registry — pure data, no React, no side effects.
// Single source of truth for all lab keyboard shortcuts.
// The overlay reads this directly; useLabHotkeys wires handlers to ids.

export type HotkeyCategory =
  | "file"
  | "editor"
  | "view"
  | "terminal"
  | "navigation";

type SingleBinding = {
  readonly kind: "single";
  readonly id: string;
  readonly label: string;
  readonly category: HotkeyCategory;
  readonly keys: string;
};

type SequenceBinding = {
  readonly kind: "sequence";
  readonly id: string;
  readonly label: string;
  readonly category: HotkeyCategory;
  readonly keys: readonly string[];
};

export type HotkeyBinding = SingleBinding | SequenceBinding;

export const HOTKEY_REGISTRY = [
  // File
  { kind: "single", id: "save", label: "Save file", category: "file", keys: "Mod+S" },
  { kind: "single", id: "close-tab", label: "Close tab", category: "file", keys: "Mod+W" },

  // View
  { kind: "single", id: "command-palette", label: "Go to file", category: "view", keys: "Mod+P" },
  { kind: "single", id: "command-mode", label: "Command palette", category: "view", keys: "Mod+Shift+P" },
  { kind: "single", id: "toggle-sidebar", label: "Toggle sidebar", category: "view", keys: "Mod+B" },
  { kind: "single", id: "shortcuts-overlay", label: "Keyboard shortcuts", category: "view", keys: "Mod+/" },
  { kind: "single", id: "close-overlay", label: "Close overlay", category: "view", keys: "Escape" },

  // Terminal
  { kind: "single", id: "focus-terminal", label: "Focus terminal", category: "terminal", keys: "Mod+`" },
  { kind: "single", id: "new-terminal", label: "New terminal", category: "terminal", keys: "Mod+Shift+`" },

  // Navigation
  { kind: "single", id: "go-to-line", label: "Go to Line", category: "navigation", keys: "Mod+G" },
  { kind: "single", id: "next-tab", label: "Next tab", category: "navigation", keys: "Mod+Shift+]" },
  { kind: "single", id: "prev-tab", label: "Previous tab", category: "navigation", keys: "Mod+Shift+[" },

  // Editor
  { kind: "single", id: "add-next-match", label: "Add Next Match", category: "editor", keys: "Mod+D" },

  // Editor (chord sequences)
  { kind: "sequence", id: "comment-line", label: "Toggle comment", category: "editor", keys: ["Mod+K", "Mod+C"] },
  { kind: "sequence", id: "uncomment-line", label: "Uncomment", category: "editor", keys: ["Mod+K", "Mod+U"] },
  { kind: "sequence", id: "fold-all", label: "Fold all", category: "editor", keys: ["Mod+K", "Mod+0"] },
  { kind: "sequence", id: "unfold-all", label: "Unfold all", category: "editor", keys: ["Mod+K", "Mod+J"] },
] as const satisfies readonly HotkeyBinding[];

export type HotkeyId = (typeof HOTKEY_REGISTRY)[number]["id"];

const CATEGORY_ORDER: readonly HotkeyCategory[] = [
  "file",
  "navigation",
  "view",
  "editor",
  "terminal",
];

export const CATEGORY_LABELS: Record<HotkeyCategory, string> = {
  file: "File",
  editor: "Editor",
  view: "View",
  terminal: "Terminal",
  navigation: "Navigation",
};

export function groupByCategory(): ReadonlyMap<HotkeyCategory, readonly HotkeyBinding[]> {
  const map = new Map<HotkeyCategory, HotkeyBinding[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const b of HOTKEY_REGISTRY) {
    map.get(b.category)?.push(b);
  }
  return map;
}

// Pre-computed grouped bindings — computed once at module level
export const GROUPED_BINDINGS = groupByCategory();

// Platform-aware display: "Cmd" on macOS, "Ctrl" elsewhere
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export function formatKey(key: string): string {
  return key
    .replace(/Mod/g, IS_MAC ? "Cmd" : "Ctrl")
    .replace(/\+/g, " + ");
}
