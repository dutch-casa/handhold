import { invoke, Channel } from "@tauri-apps/api/core";

// PTY terminal — deep module hiding Tauri IPC + Channel plumbing

// Matches Rust: #[serde(tag = "event", content = "data")]
type PtyEvent =
  | { readonly event: "data"; readonly data: { readonly data: string } }
  | { readonly event: "exit"; readonly data: { readonly code: number } };

type Disposable = { dispose: () => void };

export type TerminalHandle = {
  readonly sessionId: string;
  readonly pid: number;
  write: (data: string) => Promise<void>;
  resize: (rows: number, cols: number) => Promise<void>;
  kill: () => Promise<void>;
  onData: (cb: (data: string) => void) => Disposable;
  onExit: (cb: (code: number) => void) => Disposable;
};

export type SpawnOpts = {
  readonly env?: Record<string, string>;
  readonly shell?: string;
  readonly args?: readonly string[];
};

export async function spawn(
  cwd: string,
  opts?: SpawnOpts,
): Promise<TerminalHandle> {
  const dataListeners = new Set<(data: string) => void>();
  const exitListeners = new Set<(code: number) => void>();

  const onEvent = new Channel<PtyEvent>();
  onEvent.onmessage = (event) => {
    switch (event.event) {
      case "data":
        for (const cb of dataListeners) cb(event.data.data);
        break;
      case "exit":
        for (const cb of exitListeners) cb(event.data.code);
        break;
    }
  };

  const { sessionId, pid } = await invoke<{
    sessionId: string;
    pid: number;
  }>("pty_spawn", {
    cwd,
    shell: opts?.shell ?? "",
    args: opts?.args ?? [],
    rows: 24,
    cols: 80,
    env: Object.entries(opts?.env ?? {}),
    onData: onEvent,
  });

  return {
    sessionId,
    pid,
    write: (data) => invoke("pty_write", { sessionId, data }),
    resize: (rows, cols) => invoke("pty_resize", { sessionId, rows, cols }),
    kill: () => invoke("pty_kill", { sessionId }),
    onData: (cb) => {
      dataListeners.add(cb);
      return { dispose: () => dataListeners.delete(cb) };
    },
    onExit: (cb) => {
      exitListeners.add(cb);
      return { dispose: () => exitListeners.delete(cb) };
    },
  };
}
