// TriggerPill — colored chip rendering a trigger's verb icon + target name.
// Click opens autocomplete to edit. Backspace/Delete removes the trigger.
// Verb → color mapping is a closed enum lookup with no fallthrough.

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import type { TriggerVerb } from "@/types/lesson";

// ── Verb metadata ─────────────────────────────────────────────────

type VerbMeta = {
  readonly label: string;
  readonly color: string;
  readonly icon: string;
};

const VERB_META: Record<TriggerVerb["verb"], VerbMeta> = {
  show: { label: "show", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "👁" },
  "show-group": { label: "show-group", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "👁" },
  hide: { label: "hide", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: "🙈" },
  "hide-group": { label: "hide-group", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: "🙈" },
  focus: { label: "focus", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: "🎯" },
  zoom: { label: "zoom", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: "🔍" },
  annotate: { label: "annotate", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: "📝" },
  split: { label: "split", color: "bg-teal-500/20 text-teal-400 border-teal-500/30", icon: "⇥" },
  unsplit: { label: "unsplit", color: "bg-teal-500/20 text-teal-400 border-teal-500/30", icon: "⇤" },
  clear: { label: "clear", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: "✕" },
  transform: { label: "transform", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", icon: "↔" },
  pulse: { label: "pulse", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: "💫" },
  trace: { label: "trace", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: "✎" },
  flow: { label: "flow", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", icon: "→" },
  pan: { label: "pan", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: "✋" },
  draw: { label: "draw", color: "bg-green-500/20 text-green-300 border-green-500/30", icon: "✏" },
  play: { label: "play", color: "bg-violet-500/20 text-violet-400 border-violet-500/30", icon: "▶" },
  advance: { label: "advance", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: "⏭" },
};

function verbMeta(verb: TriggerVerb["verb"]): VerbMeta {
  return VERB_META[verb];
}

function triggerDisplayTarget(action: TriggerVerb): string {
  if ("target" in action) return action.target;
  if ("targets" in action) return action.targets.join(", ");
  return "";
}

// ── Props ─────────────────────────────────────────────────────────

type TriggerPillProps = {
  readonly action: TriggerVerb;
  readonly onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  readonly onRemove: () => void;
};

// ── Component ─────────────────────────────────────────────────────

export function TriggerPill({ action, onClick, onRemove }: TriggerPillProps) {
  const meta = verbMeta(action.verb);
  const target = triggerDisplayTarget(action);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      e.preventDefault();
      onRemove();
    },
    [onRemove],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`${meta.label}${target ? ` ${target}` : ""} trigger`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-ide-2xs font-medium
        transition-opacity duration-fast hover:opacity-80 focus-visible:outline-none
        focus-visible:ring-1 focus-visible:ring-ring min-h-[24px] ${meta.color}`}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {meta.icon}
      </span>
      <span>{meta.label}</span>
      {target && (
        <span className="opacity-70">{target}</span>
      )}
    </button>
  );
}

export { VERB_META, type VerbMeta };
