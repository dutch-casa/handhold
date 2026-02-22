// Agent panel — chat UI for the AI agent.
// Message list (auto-scrolls to bottom), input box at bottom (Cmd+Enter or Enter
// for single-line sends), streaming indicator, connection status badge.
// Lives inside Layout.Panel when panelTab === "agent".

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  useAgentStore,
  useAgentStatus,
  useAgentMessages,
  useAgentIsStreaming,
  type AgentStatus,
} from "@/editor/viewmodel/agent-store";
import { AgentMessage } from "@/editor/view/panel/AgentMessage";

// --- Connection status badge ---

function StatusBadge({ status }: { readonly status: AgentStatus }) {
  switch (status.kind) {
    case "disconnected":
      return (
        <span className="inline-flex items-center gap-sp-1 text-ide-2xs text-muted-foreground">
          <span className="h-[6px] w-[6px] rounded-full bg-muted-foreground" aria-hidden="true" />
          Disconnected
        </span>
      );
    case "connecting":
      return (
        <span className="inline-flex items-center gap-sp-1 text-ide-2xs text-chart-4">
          <span className="h-[6px] w-[6px] rounded-full bg-chart-4 animate-pulse" aria-hidden="true" />
          Connecting
        </span>
      );
    case "ready":
      return (
        <span className="inline-flex items-center gap-sp-1 text-ide-2xs text-chart-3">
          <span className="h-[6px] w-[6px] rounded-full bg-chart-3" aria-hidden="true" />
          Connected
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-sp-1 text-ide-2xs text-destructive">
          <span className="h-[6px] w-[6px] rounded-full bg-destructive" aria-hidden="true" />
          Error
        </span>
      );
  }
}

// --- Streaming indicator ---

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-sp-2 px-sp-3 py-sp-2" role="status" aria-label="Agent is thinking">
      <span className="h-[6px] w-[6px] rounded-full bg-primary animate-pulse" aria-hidden="true" />
      <span className="text-ide-2xs text-muted-foreground">Thinking...</span>
    </div>
  );
}

// --- Empty state ---

function EmptyState({ onConnect }: { readonly onConnect: () => void }) {
  return (
    <div className="ide-empty-state h-full">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground/50"
        aria-hidden="true"
      >
        <path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6H8.3C6.3 13.7 5 11.5 5 9a7 7 0 0 1 7-7z" />
        <path d="M9 22h6M10 18h4" />
      </svg>
      <span className="text-ide-xs text-muted-foreground">
        AI agent not connected
      </span>
      <button
        type="button"
        onClick={onConnect}
        className="
          flex h-[36px] min-w-[44px] items-center justify-center
          rounded-sm border border-primary/30 bg-primary/10
          px-sp-4 text-ide-xs font-medium text-primary
          press focus-ring
          transition-colors duration-fast
          hover:bg-primary/20
        "
        aria-label="Connect to AI agent"
      >
        Connect
      </button>
    </div>
  );
}

// --- Main panel ---

export function Agent() {
  const status = useAgentStatus();
  const messages = useAgentMessages();
  const isStreaming = useAgentIsStreaming();

  const connect = useAgentStore((s) => s.connect);
  const disconnect = useAgentStore((s) => s.disconnect);
  const send = useAgentStore((s) => s.send);
  const clearMessages = useAgentStore((s) => s.clearMessages);

  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    if (status.kind !== "ready") return;

    setDraft("");
    void send(trimmed);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [draft, status.kind, send]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter always sends
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
        return;
      }
      // Plain Enter sends if the input has no newlines (single-line mode)
      if (e.key === "Enter" && !e.shiftKey && !draft.includes("\n")) {
        e.preventDefault();
        handleSend();
        return;
      }
      // Shift+Enter always inserts newline (default textarea behavior)
    },
    [handleSend, draft],
  );

  const handleConnect = useCallback(() => {
    void connect();
  }, [connect]);

  // Disconnected state
  if (status.kind === "disconnected") {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader
          status={status}
          onDisconnect={disconnect}
          onClear={clearMessages}
        />
        <EmptyState onConnect={handleConnect} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        status={status}
        onDisconnect={disconnect}
        onClear={clearMessages}
      />

      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto ide-scrollbar px-sp-3 py-sp-3"
        role="list"
        aria-label="Chat messages"
      >
        {messages.length === 0 && status.kind === "ready" && (
          <div className="ide-empty-state h-full">
            <span className="text-ide-xs text-muted-foreground">
              Ask the agent to write narration, add blocks, or suggest triggers.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-sp-4">
          {messages.map((msg) => (
            <AgentMessage key={msg.id} message={msg} />
          ))}
        </div>

        {isStreaming && <StreamingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border p-sp-3">
        <div className="flex gap-sp-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              status.kind === "ready"
                ? "Ask the agent..."
                : status.kind === "connecting"
                  ? "Connecting..."
                  : "Not connected"
            }
            disabled={status.kind !== "ready"}
            rows={1}
            className="
              flex-1 resize-none rounded-sm border border-border bg-secondary/40
              px-sp-3 py-sp-2 text-ide-xs text-foreground
              placeholder:text-muted-foreground/60
              focus:border-primary/50 focus:outline-none
              disabled:cursor-not-allowed disabled:opacity-50
            "
            aria-label="Message input"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={status.kind !== "ready" || draft.trim().length === 0 || isStreaming}
            className="
              flex h-[36px] w-[36px] shrink-0 items-center justify-center
              rounded-sm border border-primary/30 bg-primary/10
              text-primary
              press focus-ring
              transition-colors duration-fast
              hover:bg-primary/20
              disabled:cursor-not-allowed disabled:opacity-30
            "
            aria-label="Send message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9z" />
            </svg>
          </button>
        </div>
        <p className="mt-sp-1 text-[10px] text-muted-foreground/50">
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- platform sniff */}
          {navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to send
        </p>
      </div>
    </div>
  );
}

// --- Panel header ---

type PanelHeaderProps = {
  readonly status: AgentStatus;
  readonly onDisconnect: () => void;
  readonly onClear: () => void;
};

function PanelHeader({ status, onDisconnect, onClear }: PanelHeaderProps) {
  return (
    <div className="ide-section-header shrink-0 justify-between">
      <div className="flex items-center gap-sp-2">
        <span>Agent</span>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-center gap-sp-1">
        {status.kind === "ready" && (
          <>
            <button
              type="button"
              onClick={onClear}
              className="tap-target rounded-sm p-sp-1 text-muted-foreground hover:text-foreground focus-ring transition-colors duration-fast"
              aria-label="Clear chat history"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              className="tap-target rounded-sm p-sp-1 text-muted-foreground hover:text-destructive focus-ring transition-colors duration-fast"
              aria-label="Disconnect agent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
