// Scene timeline — horizontal strip of scene thumbnails for a step.
// Reads computed scenes from a StepEditorStore and lets authors scrub
// through the scene sequence. Click dispatches previewScene(index).

import { useRef, useEffect, useCallback, useState, type MouseEvent } from "react";
import type { SceneState, TriggerVerb, Trigger } from "@/types/lesson";
import type { StepEditorStore, StepEditorStatus } from "@/editor/viewmodel/step-editor-store";
import type { EditableNarration } from "@/editor/model/types";
import type { StoreApi, UseBoundStore } from "zustand";

// --- Trigger label derivation ---

function verbLabel(verb: TriggerVerb): string {
  switch (verb.verb) {
    case "show":
      return `show ${verb.target}`;
    case "show-group":
      return `show ${verb.targets.join(", ")}`;
    case "hide":
      return `hide ${verb.target}`;
    case "hide-group":
      return `hide ${verb.targets.join(", ")}`;
    case "transform":
      return `${verb.from} \u2192 ${verb.to}`;
    case "clear":
      return `clear (${verb.transition})`;
    case "split":
      return "split";
    case "unsplit":
      return "unsplit";
    case "focus":
      return `focus ${verb.target}`;
    case "pulse":
      return `pulse ${verb.target}`;
    case "trace":
      return `trace ${verb.target}`;
    case "annotate":
      return `annotate ${verb.target}`;
    case "zoom":
      return `zoom ${verb.scale}x`;
    case "flow":
      return `flow ${verb.target}`;
    case "pan":
      return `pan ${verb.target}`;
    case "draw":
      return `draw ${verb.target}`;
    case "play":
      return `play ${verb.target}`;
    case "advance":
      return "advance";
  }
}

// Flatten all triggers from narration in order, matching the scene compiler.
function flattenTriggers(narration: readonly EditableNarration[]): readonly Trigger[] {
  return narration.flatMap((block) =>
    block.triggers.map((t) => ({
      wordIndex: t.wordIndex,
      text: t.text,
      action: t.action,
    })),
  );
}

// Derive a short summary for scene at index i.
// Scene 0 = initial (no trigger). Scene i>0 = allTriggers[i-1].
function sceneLabel(index: number, triggers: readonly Trigger[]): string {
  if (index === 0) return "Initial";

  const trigger = triggers[index - 1];
  if (!trigger) return "Scene";

  return verbLabel(trigger.action);
}

// Slot summary: names of visible visualizations in the scene.
function slotSummary(scene: SceneState): string {
  if (scene.slots.length === 0) return "empty";
  return scene.slots.map((s) => s.name).join(", ");
}

// --- Scene card ---

type SceneCardProps = {
  readonly index: number;
  readonly scene: SceneState;
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
};

function SceneCard({ index, scene, label, active, onClick }: SceneCardProps) {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onClick();
    },
    [onClick],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Scene ${index}: ${label}`}
      aria-pressed={active}
      className={`
        relative flex w-[120px] shrink-0 flex-col gap-1
        rounded-md border p-2
        text-left transition-colors duration-150
        focus-ring press
        ${active
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:border-muted-foreground/40"
        }
      `}
    >
      {/* Index badge */}
      <span
        className={`
          text-ide-2xs font-mono font-medium tabular-nums
          ${active ? "text-primary" : "text-muted-foreground"}
        `}
      >
        {index}
      </span>

      {/* Trigger label */}
      <span className="line-clamp-2 text-ide-2xs leading-tight text-foreground">
        {label}
      </span>

      {/* Slot summary */}
      <span className="truncate text-ide-2xs text-muted-foreground">
        {slotSummary(scene)}
      </span>

      {/* Active indicator dot */}
      {active && (
        <span
          className="absolute -bottom-2.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

// --- Timeline ---

type TimelineProps = {
  readonly store: UseBoundStore<StoreApi<StepEditorStore>>;
};

export function Timeline({ store }: TimelineProps) {
  const scenes = store((s) => s.scenes);
  const narration = store((s) => s.step.narration);
  const status = store((s) => s.status);
  const previewScene = store((s) => s.previewScene);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const activeIndex = resolveActiveIndex(status);
  const triggers = flattenTriggers(narration);

  // Scroll fade detection
  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 1);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateFade();
    el.addEventListener("scroll", updateFade, { passive: true });
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", updateFade);
      ro.disconnect();
    };
  }, [updateFade, scenes.length]);

  // Scroll active card into view
  useEffect(() => {
    if (activeIndex === null) return;

    const el = scrollRef.current;
    if (!el) return;

    const card = el.children[activeIndex] as HTMLElement | undefined;
    if (!card) return;

    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeIndex]);

  if (scenes.length === 0) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-xs text-muted-foreground">No scenes</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col" aria-label="Scene timeline">
      {/* Section header */}
      <div className="ide-section-header">
        <span>Scenes</span>
        <span className="ml-auto text-ide-2xs tabular-nums text-muted-foreground">
          {scenes.length}
        </span>
      </div>

      {/* Scrollable strip */}
      <div className="relative flex-1 min-h-0">
        {showLeftFade && (
          <div
            className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6"
            style={{ background: "linear-gradient(to right, var(--card), transparent)" }}
            aria-hidden="true"
          />
        )}

        <div
          ref={scrollRef}
          className="flex h-full items-start gap-2 overflow-x-auto px-3 py-3 ide-scrollbar"
          role="listbox"
          aria-label="Scene cards"
        >
          {scenes.map((scene, i) => (
            <SceneCard
              key={i}
              index={i}
              scene={scene}
              label={sceneLabel(i, triggers)}
              active={activeIndex === i}
              onClick={() => previewScene(i)}
            />
          ))}
        </div>

        {showRightFade && (
          <div
            className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6"
            style={{ background: "linear-gradient(to left, var(--card), transparent)" }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

// --- Helpers ---

function resolveActiveIndex(status: StepEditorStatus): number | null {
  if (status.kind !== "previewing-scene") return null;
  return status.sceneIndex;
}
