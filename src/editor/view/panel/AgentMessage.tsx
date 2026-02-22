// Chat message bubble — renders user and assistant messages with different styles.
// Assistant messages may contain AgentSuggestion cards inline after the text.

import type { ChatMessage } from "@/editor/viewmodel/agent-store";
import { AgentSuggestionCard } from "@/editor/view/panel/AgentSuggestion";

type AgentMessageProps = {
  readonly message: ChatMessage;
};

export function AgentMessage({ message }: AgentMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex flex-col gap-sp-2 ${isUser ? "items-end" : "items-start"}`}
      role="listitem"
    >
      {/* Role label */}
      <span className="text-ide-2xs font-semibold uppercase tracking-wider text-muted-foreground px-sp-1">
        {isUser ? "You" : "Agent"}
      </span>

      {/* Message bubble */}
      <div
        className={`
          max-w-[92%] rounded-md px-sp-3 py-sp-2 text-ide-xs leading-relaxed
          ${
            isUser
              ? "bg-primary/15 text-foreground"
              : "bg-secondary/60 text-foreground"
          }
        `}
      >
        {/* Render content as paragraphs split on double-newline */}
        {message.content.split("\n\n").map((paragraph, i) => {
          const key = `${message.id}-p-${String(i)}`;
          if (paragraph.trim().length === 0) return null;
          return (
            <p key={key} className={i > 0 ? "mt-sp-2" : ""}>
              {paragraph}
            </p>
          );
        })}
      </div>

      {/* Inline suggestion cards (assistant only) */}
      {!isUser && message.suggestions.length > 0 && (
        <div className="flex w-full max-w-[92%] flex-col gap-sp-2">
          {message.suggestions.map((suggestion) => (
            <AgentSuggestionCard
              key={suggestion.id}
              messageId={message.id}
              id={suggestion.id}
              kind={suggestion.kind}
              description={suggestion.description}
              status={suggestion.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
