// TriggerAutocomplete — dropdown for composing a trigger verb + target.
// Flow: user types {{ → verb list appears → select verb → target list appears → confirm.
// Arrow keys navigate, Enter selects, Escape cancels.
// Positioned relative to a provided anchor rect (textarea cursor position).

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import type { TriggerVerb } from "@/types/lesson";
import { VERB_META } from "@/editor/view/canvas/TriggerPill";

// ── Autocomplete phases ───────────────────────────────────────────

type Phase =
  | { readonly kind: "verb" }
  | { readonly kind: "target"; readonly verb: string };

// ── Verb entries ──────────────────────────────────────────────────
// Verbs that require a target vs standalone verbs.

type VerbEntry = {
  readonly verb: string;
  readonly needsTarget: boolean;
};

const VERB_ENTRIES: readonly VerbEntry[] = [
  { verb: "show", needsTarget: true },
  { verb: "hide", needsTarget: true },
  { verb: "focus", needsTarget: true },
  { verb: "zoom", needsTarget: true },
  { verb: "annotate", needsTarget: true },
  { verb: "split", needsTarget: false },
  { verb: "unsplit", needsTarget: false },
  { verb: "clear", needsTarget: false },
  { verb: "transform", needsTarget: true },
  { verb: "pulse", needsTarget: true },
  { verb: "trace", needsTarget: true },
  { verb: "flow", needsTarget: true },
  { verb: "pan", needsTarget: true },
  { verb: "draw", needsTarget: true },
  { verb: "play", needsTarget: true },
  { verb: "advance", needsTarget: false },
];

// ── Build TriggerVerb from verb + target ──────────────────────────

function buildTriggerVerb(verb: string, target: string): TriggerVerb {
  switch (verb) {
    case "show":
      return { verb: "show", target, animation: { kind: "default" } };
    case "hide":
      return { verb: "hide", target, animation: { kind: "default" } };
    case "focus":
      return { verb: "focus", target };
    case "zoom":
      return { verb: "zoom", target, scale: 1.5 };
    case "annotate":
      return { verb: "annotate", target, text: "" };
    case "split":
      return { verb: "split" };
    case "unsplit":
      return { verb: "unsplit" };
    case "clear":
      return { verb: "clear", transition: "fade", animation: { kind: "default" } };
    case "transform":
      return { verb: "transform", from: target, to: "", animation: { kind: "default" } };
    case "pulse":
      return { verb: "pulse", target };
    case "trace":
      return { verb: "trace", target };
    case "flow":
      return { verb: "flow", target };
    case "pan":
      return { verb: "pan", target };
    case "draw":
      return { verb: "draw", target };
    case "play":
      return { verb: "play", target };
    case "advance":
      return { verb: "advance" };
    default:
      return { verb: "advance" };
  }
}

// ── Props ─────────────────────────────────────────────────────────

type TriggerAutocompleteProps = {
  readonly anchorRect: { readonly top: number; readonly left: number };
  readonly blockNames: readonly string[];
  readonly regions: readonly string[];
  readonly onSelect: (verb: TriggerVerb) => void;
  readonly onCancel: () => void;
};

// ── Component ─────────────────────────────────────────────────────

export function TriggerAutocomplete({
  anchorRect,
  blockNames,
  regions,
  onSelect,
  onCancel,
}: TriggerAutocompleteProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "verb" });
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the filter input on mount and phase change.
  useEffect(() => {
    inputRef.current?.focus();
  }, [phase]);

  // Close on outside click.
  useEffect(() => {
    function handleClick(e: globalThis.MouseEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      onCancel();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onCancel]);

  // ── Items for current phase ───────────────────────────────────

  const items: readonly string[] =
    phase.kind === "verb"
      ? VERB_ENTRIES.map((v) => v.verb).filter((v) => v.includes(filter.toLowerCase()))
      : [...blockNames, ...regions].filter((t) => t.toLowerCase().includes(filter.toLowerCase()));

  // Reset highlight when items change.
  useEffect(() => {
    setHighlightIndex(0);
  }, [filter, phase]);

  // ── Selection ─────────────────────────────────────────────────

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;

      if (phase.kind === "verb") {
        const entry = VERB_ENTRIES.find((v) => v.verb === item);
        if (!entry) return;

        if (!entry.needsTarget) {
          onSelect(buildTriggerVerb(item, ""));
          return;
        }
        setPhase({ kind: "target", verb: item });
        setFilter("");
        return;
      }

      onSelect(buildTriggerVerb(phase.verb, item));
    },
    [items, phase, onSelect],
  );

  // ── Keyboard ──────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, items.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        selectItem(highlightIndex);
        return;
      }
    },
    [onCancel, items.length, highlightIndex, selectItem],
  );

  // ── Verb color dot ────────────────────────────────────────────

  function verbColor(verb: string): string {
    const meta = VERB_META[verb as TriggerVerb["verb"]];
    if (!meta) return "";
    return meta.color;
  }

  const heading = phase.kind === "verb" ? "Select trigger verb" : `${phase.verb} →`;

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Trigger autocomplete"
      className="fixed z-50 w-56 rounded-lg border border-border bg-popover shadow-lg"
      style={{ top: anchorRect.top, left: anchorRect.left }}
    >
      {/* Header */}
      <div className="border-b border-border px-sp-3 py-sp-1">
        <span className="text-ide-2xs font-medium text-muted-foreground">{heading}</span>
      </div>

      {/* Filter input */}
      <div className="px-sp-2 py-sp-1">
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={phase.kind === "verb" ? "Filter verbs..." : "Filter targets..."}
          aria-label={phase.kind === "verb" ? "Filter verbs" : "Filter targets"}
          className="w-full rounded border border-border bg-transparent px-sp-2 py-1 text-ide-xs
            text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Items */}
      <div className="max-h-48 overflow-y-auto py-sp-1">
        {items.length === 0 ? (
          <div className="px-sp-3 py-sp-2 text-ide-2xs text-muted-foreground italic">
            No matches
          </div>
        ) : (
          items.map((item, i) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={i === highlightIndex}
              onClick={() => selectItem(i)}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`flex w-full items-center gap-sp-2 px-sp-3 py-1 text-left text-ide-xs
                transition-colors duration-fast min-h-[32px]
                ${i === highlightIndex ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/50"}`}
            >
              {phase.kind === "verb" ? (
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-ide-2xs font-medium ${verbColor(item)}`}>
                  {item}
                </span>
              ) : (
                <span className="font-mono">{item}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
