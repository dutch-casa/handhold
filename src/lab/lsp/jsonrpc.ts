const encoder = new TextEncoder();

export function frame(json: string): string {
  const byteLength = encoder.encode(json).byteLength;
  return `Content-Length: ${byteLength}\r\n\r\n${json}`;
}

type PendingRequest = {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: Error) => void;
  readonly method: string;
  readonly timer: ReturnType<typeof setTimeout>;
};

const REQUEST_TIMEOUT_MS = 30_000;

export class JsonRpcClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly notificationHandlers = new Map<string, (params: unknown) => void>();

  constructor(private readonly send: (framed: string) => Promise<void>) {}

  async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const message = JSON.stringify({ jsonrpc: "2.0", id, method, params });

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`LSP request '${method}' timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, method, timer });
      this.send(frame(message)).catch((err) => {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  notify(method: string, params: unknown): void {
    const message = JSON.stringify({ jsonrpc: "2.0", method, params });
    this.send(frame(message));
  }

  onNotification(method: string, handler: (params: unknown) => void): void {
    this.notificationHandlers.set(method, handler);
  }

  handleMessage(json: string): void {
    let msg: { id?: number; method?: string; result?: unknown; error?: { message: string }; params?: unknown };
    try {
      msg = JSON.parse(json) as typeof msg;
    } catch {
      return;
    }

    // Response to a pending request
    if (msg.id !== undefined) {
      const pending = this.pending.get(msg.id);
      if (pending === undefined) return;
      this.pending.delete(msg.id);
      clearTimeout(pending.timer);

      if (msg.error !== undefined) {
        pending.reject(new Error(msg.error.message));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    // Server notification
    if (msg.method !== undefined) {
      const handler = this.notificationHandlers.get(msg.method);
      if (handler !== undefined) handler(msg.params);
    }
  }

  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("JsonRpcClient disposed"));
      this.pending.delete(id);
    }
    this.notificationHandlers.clear();
  }
}
