import {
  FileCode2,
  FileJson,
  FileText,
  FileType,
  File,
  Braces,
  Hash,
  Palette,
  Globe,
  Database,
  Settings,
  Package,
  Lock,
  Image,
  FileTerminal,
  Cog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type FileIconEntry = {
  readonly icon: LucideIcon;
  readonly color: string;
};

// Data-driven: extension → icon + color. No conditionals.
const EXT_ICONS: Record<string, FileIconEntry> = {
  // TypeScript / JavaScript
  ts: { icon: FileCode2, color: "#3178c6" },
  tsx: { icon: FileCode2, color: "#3178c6" },
  js: { icon: FileCode2, color: "#f7df1e" },
  jsx: { icon: FileCode2, color: "#f7df1e" },
  mjs: { icon: FileCode2, color: "#f7df1e" },
  cjs: { icon: FileCode2, color: "#f7df1e" },

  // Data / Config
  json: { icon: FileJson, color: "#ffa657" },
  yaml: { icon: FileJson, color: "#cb171e" },
  yml: { icon: FileJson, color: "#cb171e" },
  toml: { icon: Cog, color: "#9c4221" },

  // Web
  html: { icon: Globe, color: "#e44d26" },
  htm: { icon: Globe, color: "#e44d26" },
  css: { icon: Palette, color: "#264de4" },
  scss: { icon: Palette, color: "#c6538c" },
  less: { icon: Palette, color: "#1d365d" },
  svg: { icon: Image, color: "#ffb13b" },

  // Systems
  rs: { icon: Braces, color: "#dea584" },
  go: { icon: FileCode2, color: "#00add8" },
  c: { icon: Hash, color: "#555555" },
  cpp: { icon: Hash, color: "#f34b7d" },
  h: { icon: Hash, color: "#555555" },
  hpp: { icon: Hash, color: "#f34b7d" },

  // Scripting
  py: { icon: FileCode2, color: "#3572a5" },
  rb: { icon: FileCode2, color: "#cc342d" },
  java: { icon: FileCode2, color: "#b07219" },
  kt: { icon: FileCode2, color: "#a97bff" },
  swift: { icon: FileCode2, color: "#f05138" },

  // Shell
  sh: { icon: FileTerminal, color: "#89e051" },
  bash: { icon: FileTerminal, color: "#89e051" },
  zsh: { icon: FileTerminal, color: "#89e051" },
  fish: { icon: FileTerminal, color: "#89e051" },

  // Database
  sql: { icon: Database, color: "#e38c00" },

  // Docs
  md: { icon: FileText, color: "#083fa1" },
  mdx: { icon: FileText, color: "#083fa1" },
  txt: { icon: FileText, color: "#8a8880" },

  // Images
  png: { icon: Image, color: "#a074c4" },
  jpg: { icon: Image, color: "#a074c4" },
  jpeg: { icon: Image, color: "#a074c4" },
  gif: { icon: Image, color: "#a074c4" },
  webp: { icon: Image, color: "#a074c4" },
  ico: { icon: Image, color: "#a074c4" },

  // Font
  woff: { icon: FileType, color: "#8a8880" },
  woff2: { icon: FileType, color: "#8a8880" },
  ttf: { icon: FileType, color: "#8a8880" },
  otf: { icon: FileType, color: "#8a8880" },
};

// Special filenames that override extension matching
const NAME_ICONS: Record<string, FileIconEntry> = {
  "package.json": { icon: Package, color: "#cb3837" },
  "package-lock.json": { icon: Lock, color: "#cb3837" },
  "bun.lock": { icon: Lock, color: "#f472b6" },
  "bun.lockb": { icon: Lock, color: "#f472b6" },
  "tsconfig.json": { icon: Settings, color: "#3178c6" },
  "Cargo.toml": { icon: Package, color: "#dea584" },
  "Cargo.lock": { icon: Lock, color: "#dea584" },
  ".gitignore": { icon: Cog, color: "#f05032" },
  "Dockerfile": { icon: FileTerminal, color: "#2496ed" },
  "docker-compose.yml": { icon: FileTerminal, color: "#2496ed" },
  "docker-compose.yaml": { icon: FileTerminal, color: "#2496ed" },
  "vite.config.ts": { icon: Settings, color: "#646cff" },
  "tailwind.config.ts": { icon: Settings, color: "#38bdf8" },
  "tailwind.config.js": { icon: Settings, color: "#38bdf8" },
};

const DEFAULT_ICON: FileIconEntry = { icon: File, color: "#8a8880" };

export function getFileIcon(name: string, ext: string): FileIconEntry {
  return NAME_ICONS[name] ?? EXT_ICONS[ext] ?? DEFAULT_ICON;
}

export function FileIcon({
  name,
  ext,
  className,
}: {
  readonly name: string;
  readonly ext: string;
  readonly className?: string;
}) {
  const { icon: Icon, color } = getFileIcon(name, ext);
  return <Icon className={className ?? "size-3.5 shrink-0"} style={{ color }} />;
}
