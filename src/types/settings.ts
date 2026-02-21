// App settings — persisted to ~/.handhold/settings.json

export type LineNumbers = "on" | "off" | "relative";

export type EditorSettings = {
  readonly vimMode: boolean;
  readonly ligatures: boolean;
  readonly fontSize: number;
  readonly tabSize: number;
  readonly wordWrap: boolean;
  readonly lineNumbers: LineNumbers;
  readonly bracketColors: boolean;
  readonly minimap: boolean;
  readonly stickyScroll: boolean;
  readonly autoSave: boolean;
  readonly autoSaveDelay: number;
};

export type SidebarPanel = "explorer" | "instructions" | "search" | "services" | "testing" | "settings" | "solution";

export type AppSettings = {
  readonly editor: EditorSettings;
  readonly sidebarPanel: SidebarPanel;
  readonly sidebarCollapsed: boolean;
  readonly suppressCloseConfirm: boolean;
};

export const DEFAULT_EDITOR: EditorSettings = {
  vimMode: false,
  ligatures: true,
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: "on",
  bracketColors: true,
  minimap: true,
  stickyScroll: false,
  autoSave: false,
  autoSaveDelay: 1000,
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  editor: DEFAULT_EDITOR,
  sidebarPanel: "explorer",
  sidebarCollapsed: false,
  suppressCloseConfirm: false,
} as const;
