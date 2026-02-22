// Typed HTTP + SSE client for the opencode AI coding agent server.
// One class, one concern: session lifecycle, messaging, and event streaming.

// --- Wire types: match the opencode server's JSON shapes ---

export type OpenCodeConfig = {
  readonly baseUrl: string;
  readonly password?: string | undefined;
};

export type Session = {
  readonly id: string;
  readonly createdAt: number;
};

export type MessagePart = {
  readonly type: "text" | "tool-use" | "tool-result";
  readonly content: string;
};

export type SessionMessage = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly parts: readonly MessagePart[];
  readonly createdAt: number;
};

export type ServerEvent =
  | {
      readonly type: "message.start";
      readonly messageId: string;
    }
  | {
      readonly type: "message.delta";
      readonly messageId: string;
      readonly content: string;
    }
  | {
      readonly type: "message.complete";
      readonly messageId: string;
      readonly message: SessionMessage;
    }
  | {
      readonly type: "tool.start";
      readonly toolName: string;
      readonly args: string;
    }
  | {
      readonly type: "tool.complete";
      readonly toolName: string;
      readonly result: string;
    };

const SERVER_EVENT_TYPES = new Set([
  "message.start",
  "message.delta",
  "message.complete",
  "tool.start",
  "tool.complete",
]);

function isServerEvent(raw: unknown): raw is ServerEvent {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return typeof obj["type"] === "string" && SERVER_EVENT_TYPES.has(obj["type"]);
}

// --- Client ---

const DEFAULT_BASE_URL = "http://127.0.0.1:4096";
const SSE_RECONNECT_DELAY_MS = 2000;

export class OpenCodeClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: OpenCodeConfig) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.headers = { "Content-Type": "application/json" };
    if (config.password !== undefined) {
      this.headers["Authorization"] =
        `Basic ${btoa(":" + config.password)}`;
    }
  }

  // --- Session lifecycle ---

  async createSession(): Promise<Session> {
    const res = await this.request("POST", "/session");
    return res as Session;
  }

  async getSession(id: string): Promise<Session> {
    const res = await this.request("GET", `/session/${encodeURIComponent(id)}`);
    return res as Session;
  }

  // --- Messaging ---

  async sendMessage(sessionId: string, content: string): Promise<void> {
    await this.request(
      "POST",
      `/session/${encodeURIComponent(sessionId)}/message`,
      { content },
    );
  }

  // --- SSE event stream with auto-reconnect ---
  // Returns an unsubscribe function. The callback fires for every parsed ServerEvent.
  // Uses fetch + ReadableStream instead of EventSource for header support.

  subscribe(onEvent: (event: ServerEvent) => void): () => void {
    let alive = true;
    let abortController = new AbortController();

    const connect = async () => {
      while (alive) {
        try {
          const res = await fetch(`${this.baseUrl}/event`, {
            headers: this.headers,
            signal: abortController.signal,
          });
          if (!res.ok || !res.body) {
            throw new Error(`SSE connect failed: ${res.status}`);
          }
          await this.consumeSSEStream(res.body, onEvent, abortController.signal);
        } catch (err) {
          if (!alive) return;
          // Swallow AbortError on teardown
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Reconnect after delay
          await delay(SSE_RECONNECT_DELAY_MS);
        }
      }
    };

    void connect();

    return () => {
      alive = false;
      abortController.abort();
    };
  }

  // --- Health check ---

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/agent`, {
        headers: this.headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Internals ---

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const init: RequestInit = { method, headers: this.headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${this.baseUrl}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`opencode ${method} ${path}: ${res.status} ${text}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return undefined;
  }

  // Parses an SSE byte stream into ServerEvent objects.
  // SSE format: "event: <type>\ndata: <json>\n\n"
  private async consumeSSEStream(
    body: ReadableStream<Uint8Array>,
    onEvent: (event: ServerEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) return;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");

        // Last element is the incomplete chunk (or empty string after trailing \n\n)
        buffer = parts.pop()!;

        for (const raw of parts) {
          const parsed = parseSSEChunk(raw);
          if (parsed !== undefined) {
            onEvent(parsed);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Parse a single SSE chunk ("event: ...\ndata: ...") into a ServerEvent or undefined.
function parseSSEChunk(chunk: string): ServerEvent | undefined {
  let data: string | undefined;

  for (const line of chunk.split("\n")) {
    if (line.startsWith("data:")) {
      data = line.slice(5).trimStart();
    }
  }

  if (data === undefined) return undefined;

  try {
    const parsed: unknown = JSON.parse(data);
    if (isServerEvent(parsed)) return parsed;
    return undefined;
  } catch {
    return undefined;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
