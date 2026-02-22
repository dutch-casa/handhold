// Agent store — session lifecycle, chat messages, streaming, and suggestion tracking.
// Single deep module: all actions in one create(). Views select, never set.
// Uses OpenCodeClient for session + SSE, context builder for editor snapshots.

import { create } from "zustand";
import {
  OpenCodeClient,
  type ServerEvent,
  type OpenCodeConfig,
} from "@/editor/agent/opencode-client";
import {
  buildAgentContext,
  type EditorSnapshot,
} from "@/editor/agent/context-builder";

// --- Domain types ---

export type AgentStatus =
  | { readonly kind: "disconnected" }
  | { readonly kind: "connecting" }
  | { readonly kind: "ready"; readonly sessionId: string }
  | { readonly kind: "error"; readonly message: string };

export type ChatRole = "user" | "assistant";

export type SuggestionKind =
  | "add-block"
  | "update-narration"
  | "add-trigger"
  | "add-step"
  | "update-block";

export type SuggestionStatus = "pending" | "accepted" | "rejected";

export type AgentSuggestion = {
  readonly id: string;
  readonly kind: SuggestionKind;
  readonly description: string;
  readonly patch: unknown;
  readonly status: SuggestionStatus;
};

export type ChatMessage = {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly timestamp: number;
  readonly suggestions: readonly AgentSuggestion[];
};

// --- Store shape ---

type AgentState = {
  readonly status: AgentStatus;
  readonly messages: readonly ChatMessage[];
  readonly isStreaming: boolean;
};

type AgentActions = {
  connect(config?: OpenCodeConfig): Promise<void>;
  disconnect(): void;
  send(prompt: string, snapshot?: EditorSnapshot): Promise<void>;
  applySuggestion(messageId: string, suggestionId: string): void;
  rejectSuggestion(messageId: string, suggestionId: string): void;
  clearMessages(): void;
};

export type AgentStore = AgentState & AgentActions;

const INITIAL: AgentState = {
  status: { kind: "disconnected" },
  messages: [],
  isStreaming: false,
};

// Mutable closure state — not in the store, not reactive, not exposed.
// Only the actions reference these.
let client: OpenCodeClient | null = null;
let unsubscribe: (() => void) | null = null;
let streamingMessageId: string | null = null;
let streamingContent = "";

function resetClientState(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  client = null;
  streamingMessageId = null;
  streamingContent = "";
}

// --- Helpers ---

function updateSuggestionInMessages(
  messages: readonly ChatMessage[],
  messageId: string,
  suggestionId: string,
  newStatus: SuggestionStatus,
): readonly ChatMessage[] {
  return messages.map((msg) => {
    if (msg.id !== messageId) return msg;
    return {
      ...msg,
      suggestions: msg.suggestions.map((s) => {
        if (s.id !== suggestionId) return s;
        return { ...s, status: newStatus };
      }),
    };
  });
}

function appendOrUpdateStreamingMessage(
  messages: readonly ChatMessage[],
  messageId: string,
  content: string,
): readonly ChatMessage[] {
  const existing = messages.find((m) => m.id === messageId);
  if (existing) {
    return messages.map((m) => {
      if (m.id !== messageId) return m;
      return { ...m, content };
    });
  }
  const newMsg: ChatMessage = {
    id: messageId,
    role: "assistant",
    content,
    timestamp: Date.now(),
    suggestions: [],
  };
  return [...messages, newMsg];
}

// --- Store ---

export const useAgentStore = create<AgentStore>((set, get) => ({
  ...INITIAL,

  connect: async (config) => {
    const currentStatus = get().status;
    if (currentStatus.kind === "connecting" || currentStatus.kind === "ready") {
      return;
    }

    set({ status: { kind: "connecting" } });

    const resolvedConfig: OpenCodeConfig = config ?? {
      baseUrl: "http://127.0.0.1:4096",
    };
    client = new OpenCodeClient(resolvedConfig);

    try {
      const ok = await client.ping();
      if (!ok) {
        set({ status: { kind: "error", message: "Agent server unreachable" } });
        resetClientState();
        return;
      }

      const session = await client.createSession();

      // Subscribe to SSE events
      unsubscribe = client.subscribe((event: ServerEvent) => {
        handleServerEvent(event, set, get);
      });

      set({ status: { kind: "ready", sessionId: session.id } });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Connection failed";
      set({ status: { kind: "error", message } });
      resetClientState();
    }
  },

  disconnect: () => {
    resetClientState();
    set({ status: { kind: "disconnected" }, isStreaming: false });
  },

  send: async (prompt, snapshot) => {
    const { status } = get();
    if (status.kind !== "ready") return;
    if (!client) return;

    // Build context-enriched prompt
    const contextBlock =
      snapshot !== undefined ? buildAgentContext(snapshot) : "";
    const fullPrompt =
      contextBlock.length > 0
        ? `${contextBlock}\n\n---\n\n${prompt}`
        : prompt;

    // Append user message immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt, // Display only the user's prompt, not the injected context
      timestamp: Date.now(),
      suggestions: [],
    };
    set({ messages: [...get().messages, userMsg], isStreaming: true });

    try {
      await client.sendMessage(status.sessionId, fullPrompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed";
      set({
        isStreaming: false,
        status: { kind: "error", message },
      });
    }
  },

  applySuggestion: (messageId, suggestionId) => {
    const { messages } = get();
    set({
      messages: updateSuggestionInMessages(
        messages,
        messageId,
        suggestionId,
        "accepted",
      ),
    });
    // TODO: dispatch actual course mutation through course-editor-store
  },

  rejectSuggestion: (messageId, suggestionId) => {
    const { messages } = get();
    set({
      messages: updateSuggestionInMessages(
        messages,
        messageId,
        suggestionId,
        "rejected",
      ),
    });
  },

  clearMessages: () => {
    streamingMessageId = null;
    streamingContent = "";
    set({ messages: [], isStreaming: false });
  },
}));

// --- SSE event handler (runs outside React, mutates store) ---

function handleServerEvent(
  event: ServerEvent,
  set: (partial: Partial<AgentState>) => void,
  get: () => AgentStore,
): void {
  switch (event.type) {
    case "message.start": {
      streamingMessageId = event.messageId;
      streamingContent = "";
      set({ isStreaming: true });
      break;
    }
    case "message.delta": {
      if (streamingMessageId !== event.messageId) return;
      streamingContent += event.content;
      set({
        messages: appendOrUpdateStreamingMessage(
          get().messages,
          event.messageId,
          streamingContent,
        ),
      });
      break;
    }
    case "message.complete": {
      // Finalize the streamed message with the server's authoritative content
      const textParts = event.message.parts.filter((p) => p.type === "text");
      const finalContent = textParts.map((p) => p.content).join("\n\n");

      // Extract suggestions from tool-result parts (if any)
      const suggestions = extractSuggestions(event.message.parts);

      const finalMsg: ChatMessage = {
        id: event.messageId,
        role: event.message.role,
        content: finalContent,
        timestamp: event.message.createdAt,
        suggestions,
      };

      const messages = get().messages.filter(
        (m) => m.id !== event.messageId,
      );
      set({
        messages: [...messages, finalMsg],
        isStreaming: false,
      });

      streamingMessageId = null;
      streamingContent = "";
      break;
    }
    case "tool.start":
    case "tool.complete":
      // Tool events are informational — no store mutation needed yet.
      break;
  }
}

// Parse tool-result parts for structured suggestions.
// The agent returns suggestions as JSON in tool-result content.
function extractSuggestions(
  parts: readonly { readonly type: string; readonly content: string }[],
): readonly AgentSuggestion[] {
  const results: AgentSuggestion[] = [];

  for (const part of parts) {
    if (part.type !== "tool-result") continue;

    try {
      const parsed: unknown = JSON.parse(part.content);
      if (!isSuggestionPayload(parsed)) continue;

      results.push({
        id: crypto.randomUUID(),
        kind: parsed.kind,
        description: parsed.description,
        patch: parsed.patch,
        status: "pending",
      });
    } catch {
      // Not JSON or not a suggestion — skip.
    }
  }

  return results;
}

const SUGGESTION_KINDS = new Set<string>([
  "add-block",
  "update-narration",
  "add-trigger",
  "add-step",
  "update-block",
]);

type SuggestionPayload = {
  readonly kind: SuggestionKind;
  readonly description: string;
  readonly patch: unknown;
};

function isSuggestionPayload(raw: unknown): raw is SuggestionPayload {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj["kind"] === "string" &&
    SUGGESTION_KINDS.has(obj["kind"]) &&
    typeof obj["description"] === "string"
  );
}

// --- Selectors ---

export function useAgentStatus(): AgentStatus {
  return useAgentStore((s) => s.status);
}

export function useAgentMessages(): readonly ChatMessage[] {
  return useAgentStore((s) => s.messages);
}

export function useAgentIsStreaming(): boolean {
  return useAgentStore((s) => s.isStreaming);
}

export function useAgentIsReady(): boolean {
  return useAgentStore((s) => s.status.kind === "ready");
}
