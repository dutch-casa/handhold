// Suggestion card — shows kind icon, description, and [Apply] / [Reject] buttons.
// Apply dispatches the corresponding action and marks "accepted" (green).
// Reject marks "rejected" (dim). Once acted on, buttons disappear.

import { useAgentStore, type SuggestionKind, type SuggestionStatus } from "@/editor/viewmodel/agent-store";

// --- Kind → icon mapping ---

const KIND_ICONS: Record<SuggestionKind, string> = {
  "add-block": "\u2795",     // heavy plus
  "update-narration": "\uD83D\uDCDD", // memo
  "add-trigger": "\u26A1",   // zap
  "add-step": "\uD83D\uDCC4",  // page
  "update-block": "\u270F\uFE0F", // pencil
};

const KIND_LABELS: Record<SuggestionKind, string> = {
  "add-block": "Add Block",
  "update-narration": "Update Narration",
  "add-trigger": "Add Trigger",
  "add-step": "Add Step",
  "update-block": "Update Block",
};

// --- Status styling ---

function statusClasses(status: SuggestionStatus): string {
  switch (status) {
    case "pending":
      return "border-border bg-secondary/40";
    case "accepted":
      return "border-chart-3/40 bg-chart-3/10";
    case "rejected":
      return "border-border/50 bg-secondary/20 opacity-50";
  }
}

// --- Component ---

type AgentSuggestionProps = {
  readonly messageId: string;
  readonly id: string;
  readonly kind: SuggestionKind;
  readonly description: string;
  readonly status: SuggestionStatus;
};

export function AgentSuggestionCard({
  messageId,
  id,
  kind,
  description,
  status,
}: AgentSuggestionProps) {
  const apply = useAgentStore((s) => s.applySuggestion);
  const reject = useAgentStore((s) => s.rejectSuggestion);

  const isPending = status === "pending";

  return (
    <div
      className={`
        flex flex-col gap-sp-2 rounded-md border p-sp-3
        transition-colors duration-fast
        ${statusClasses(status)}
      `}
      role="group"
      aria-label={`Suggestion: ${KIND_LABELS[kind]}`}
    >
      {/* Header row: icon + kind label */}
      <div className="flex items-center gap-sp-2">
        <span className="text-ide-sm" aria-hidden="true">
          {KIND_ICONS[kind]}
        </span>
        <span className="text-ide-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {KIND_LABELS[kind]}
        </span>

        {status === "accepted" && (
          <span className="ml-auto text-ide-xs text-chart-3 font-medium">
            Applied
          </span>
        )}
        {status === "rejected" && (
          <span className="ml-auto text-ide-xs text-muted-foreground font-medium">
            Rejected
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-ide-xs leading-relaxed text-foreground/80">
        {description}
      </p>

      {/* Action buttons — only when pending */}
      {isPending && (
        <div className="flex gap-sp-2">
          <button
            type="button"
            onClick={() => apply(messageId, id)}
            className="
              flex h-[32px] min-w-[44px] items-center justify-center
              rounded-sm border border-chart-3/30 bg-chart-3/10
              px-sp-3 text-ide-xs font-medium text-chart-3
              press focus-ring
              transition-colors duration-fast
              hover:bg-chart-3/20
            "
            aria-label={`Apply suggestion: ${description}`}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => reject(messageId, id)}
            className="
              flex h-[32px] min-w-[44px] items-center justify-center
              rounded-sm border border-border bg-secondary/40
              px-sp-3 text-ide-xs font-medium text-muted-foreground
              press focus-ring
              transition-colors duration-fast
              hover:bg-secondary/60
            "
            aria-label={`Reject suggestion: ${description}`}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
