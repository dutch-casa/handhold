import { invoke, Channel } from "@tauri-apps/api/core";

type Disposable = { dispose: () => void };

// Matches Rust: #[serde(tag = "event")]
type LspEvent =
  | { readonly event: "message"; readonly data: string }
  | { readonly event: "exit"; readonly code: number }
  | { readonly event: "error"; readonly message: string };

export type LspHandle = {
  readonly sessionId: string;
  readonly send: (data: string) => Promise<void>;
  readonly kill: () => Promise<void>;
  readonly onMessage: (cb: (json: string) => void) => Disposable;
  readonly onExit: (cb: (code: number) => void) => Disposable;
  readonly onError: (cb: (msg: string) => void) => Disposable;
};

export async function spawnLsp(
  containerName: string,
  serverBinary: string,
  serverArgs: readonly string[],
): Promise<LspHandle> {
  const messageListeners = new Set<(json: string) => void>();
  const exitListeners = new Set<(code: number) => void>();
  const errorListeners = new Set<(msg: string) => void>();

  const onEvent = new Channel<LspEvent>();
  onEvent.onmessage = (event) => {
    switch (event.event) {
      case "message":
        for (const cb of messageListeners) cb(event.data);
        break;
      case "exit":
        for (const cb of exitListeners) cb(event.code);
        break;
      case "error":
        for (const cb of errorListeners) cb(event.message);
        break;
    }
  };

  const { sessionId } = await invoke<{ sessionId: string }>("lsp_spawn", {
    containerName,
    serverBinary,
    serverArgs: [...serverArgs],
    onEvent,
  });

  return {
    sessionId,
    send: (data) => invoke("lsp_send", { sessionId, data }),
    kill: () => invoke("lsp_kill", { sessionId }),
    onMessage: (cb) => {
      messageListeners.add(cb);
      return { dispose: () => messageListeners.delete(cb) };
    },
    onExit: (cb) => {
      exitListeners.add(cb);
      return { dispose: () => exitListeners.delete(cb) };
    },
    onError: (cb) => {
      errorListeners.add(cb);
      return { dispose: () => errorListeners.delete(cb) };
    },
  };
}
