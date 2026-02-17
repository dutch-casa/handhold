// Lab IR — the contract between manifest parser and lab runtime.
// Every field is structurally required. No optionals in the domain model.

// --- Resolved service: preset or custom, same type after resolution ---

export type ResolvedService = {
  readonly name: string;
  readonly image: string;
  readonly port: number;
  readonly hostPort: number;
  readonly env: Readonly<Record<string, string>>;
  readonly healthcheck: string;
};

// --- Parsed lab manifest ---

export type ParsedLab = {
  readonly title: string;
  readonly instructions: string;
  readonly filesPath: string;
  readonly workspace: "fresh" | "continue";
  readonly testCommand: string;
  readonly openFiles: readonly string[];
  readonly services: readonly ResolvedService[];
  readonly setup: readonly string[];
  readonly start: readonly string[];
};

// --- Lifecycle typestate: each state carries only data valid at that phase ---

export type LabUninitialized = {
  readonly kind: "uninitialized";
  readonly lab: ParsedLab;
};

export type LabProvisioning = {
  readonly kind: "provisioning";
  readonly lab: ParsedLab;
  readonly workspacePath: string;
  readonly log: readonly string[];
};

export type LabReady = {
  readonly kind: "ready";
  readonly lab: ParsedLab;
  readonly workspacePath: string;
};

export type LabFailed = {
  readonly kind: "failed";
  readonly lab: ParsedLab;
  readonly error: string;
};

export type LabMissingRuntime = {
  readonly kind: "missing_runtime";
  readonly lab: ParsedLab;
};

export type LabTearingDown = {
  readonly kind: "tearing-down";
  readonly lab: ParsedLab;
  readonly workspacePath: string;
};

export type LabLifecycle =
  | LabUninitialized
  | LabProvisioning
  | LabReady
  | LabFailed
  | LabMissingRuntime
  | LabTearingDown;

// --- File tree: flat entries from Tauri, tree derived by selector ---

export type FsFileEntry = {
  readonly kind: "file";
  readonly path: string;
  readonly name: string;
  readonly ext: string;
};

export type FsDirEntry = {
  readonly kind: "dir";
  readonly path: string;
  readonly name: string;
};

export type FsEntry = FsFileEntry | FsDirEntry;

// Derived tree for rendering — not stored, computed from flat entries
export type FileTreeFile = {
  readonly kind: "file";
  readonly path: string;
  readonly name: string;
  readonly ext: string;
};

export type FileTreeDir = {
  readonly kind: "dir";
  readonly path: string;
  readonly name: string;
  readonly children: readonly FileTreeNode[];
};

export type FileTreeNode = FileTreeFile | FileTreeDir;

// --- Test run state ---

export type TestAssertion = {
  readonly index: number;
  readonly description: string;
  readonly passed: boolean;
};

export type TestRunState =
  | { readonly kind: "idle" }
  | { readonly kind: "running"; readonly output: string }
  | { readonly kind: "passed"; readonly assertions: readonly TestAssertion[]; readonly output: string; readonly durationMs: number }
  | { readonly kind: "failed"; readonly assertions: readonly TestAssertion[]; readonly output: string; readonly durationMs: number }
  | { readonly kind: "error"; readonly message: string };

// --- Terminal tab ---

export type TerminalTab = {
  readonly id: string;
  readonly title: string;
};

// --- Container runtime ---

export type ContainerRuntime = {
  readonly binary: "podman" | "docker";
  readonly version: string;
};

// --- Service status ---

export type ServiceStatus = "starting" | "healthy" | "failed";

// --- Container runtime state (view-layer discriminated union) ---

export type RuntimeState =
  | { readonly kind: "detecting" }
  | { readonly kind: "ready"; readonly binary: "podman" | "docker"; readonly version: string }
  | { readonly kind: "missing" };

// --- Container state (per-container discriminated union) ---

export type ContainerState =
  | { readonly kind: "running"; readonly health: "healthy" | "unhealthy" | "starting" | "none" }
  | { readonly kind: "stopped" }
  | { readonly kind: "error"; readonly message: string };

export type ContainerView = {
  readonly name: string;
  readonly image: string;
  readonly state: ContainerState;
  readonly ports: string;
};
