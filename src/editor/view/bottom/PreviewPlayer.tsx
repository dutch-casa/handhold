// PreviewPlayer — scene-by-scene preview embedded in the bottom bar.
// Renders a state summary for each scene (visible slot names, focus target)
// rather than embedding the full Presentation component.
// Single writer: only this component's controls drive previewScene/exitPreview.

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { StepEditorStore } from "@/editor/viewmodel/step-editor-store";
import type { SceneState, VisualizationState } from "@/types/lesson";

// --- Props ---

type PreviewPlayerProps = {
  readonly store: UseBoundStore<StoreApi<StepEditorStore>>;
};

// --- Slot badge: one per visible visualization in the scene ---

function SlotBadge({
  slot,
  isFocused,
}: {
  readonly slot: VisualizationState;
  readonly isFocused: boolean;
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-ide-2xs
        ${isFocused
          ? "bg-primary/20 text-primary ring-1 ring-primary/40"
          : "bg-secondary text-muted-foreground"
        }
      `}
    >
      <KindIcon kind={slot.kind} />
      {slot.name}
    </span>
  );
}

// --- Tiny kind icon (6x6 inline SVG) ---

function KindIcon({ kind }: { readonly kind: VisualizationState["kind"] }) {
  const cls = "inline-block shrink-0 opacity-60";
  switch (kind) {
    case "code":
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className={cls}>
          <path d="M3.5 2L1 5l2.5 3" />
          <path d="M6.5 2L9 5l-2.5 3" />
        </svg>
      );
    case "data":
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className={cls}>
          <rect x="1" y="3" width="8" height="4" rx="0.5" />
          <path d="M3.5 3v4M6.5 3v4" />
        </svg>
      );
    case "diagram":
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className={cls}>
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="7" cy="7" r="1.5" />
          <path d="M4.2 4.2L5.8 5.8" />
        </svg>
      );
    case "math":
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className={cls}>
          <path d="M2 5h6M5 2v6" />
        </svg>
      );
    case "chart":
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className={cls}>
          <path d="M2 8V4M5 8V2M8 8V5" />
        </svg>
      );
    case "preview":
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className={cls}>
          <rect x="1" y="2" width="8" height="6" rx="1" />
          <path d="M1 4h8" />
        </svg>
      );
  }
}

// --- Scene state card ---

function SceneCard({
  scene,
  index,
  active,
}: {
  readonly scene: SceneState;
  readonly index: number;
  readonly active: boolean;
}) {
  const hasSlots = scene.slots.length > 0;

  return (
    <div
      className={`
        flex flex-col gap-1 rounded-md border px-2 py-1.5 transition-colors duration-fast
        ${active
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-background"
        }
      `}
    >
      <span className="text-ide-2xs font-medium text-muted-foreground">
        Scene {index + 1}
      </span>
      {hasSlots ? (
        <div className="flex flex-wrap gap-1">
          {scene.slots.map((slot) => (
            <SlotBadge
              key={slot.name}
              slot={slot}
              isFocused={scene.focus === slot.name}
            />
          ))}
        </div>
      ) : (
        <span className="text-ide-2xs italic text-muted-foreground/50">empty</span>
      )}
      {scene.focus !== "" && (
        <span className="text-ide-2xs text-primary/70">focus: {scene.focus}</span>
      )}
    </div>
  );
}

// --- Auto-play hook ---

function useAutoPlay(
  playing: boolean,
  sceneCount: number,
  currentIndex: number,
  goToScene: (index: number) => void,
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing || sceneCount === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    timerRef.current = setInterval(() => {
      goToScene(currentIndex + 1);
    }, 2000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, currentIndex, sceneCount, goToScene]);
}

// --- PreviewPlayer ---

export function PreviewPlayer({ store }: PreviewPlayerProps) {
  const scenes = store((s) => s.scenes);
  const status = store((s) => s.status);
  const previewScene = store((s) => s.previewScene);
  const exitPreview = store((s) => s.exitPreview);

  const [playing, setPlaying] = useState(false);

  const currentIndex =
    status.kind === "previewing-scene" ? status.sceneIndex : 0;

  const sceneCount = scenes.length;

  const goToScene = useCallback(
    (index: number) => {
      if (index < 0 || index >= sceneCount) {
        setPlaying(false);
        return;
      }
      previewScene(index);
    },
    [sceneCount, previewScene],
  );

  useAutoPlay(playing, sceneCount, currentIndex, goToScene);

  const handlePrev = useCallback(() => {
    setPlaying(false);
    goToScene(currentIndex - 1);
  }, [currentIndex, goToScene]);

  const handleNext = useCallback(() => {
    setPlaying(false);
    goToScene(currentIndex + 1);
  }, [currentIndex, goToScene]);

  const handlePlayPause = useCallback(() => {
    if (sceneCount === 0) return;

    if (playing) {
      setPlaying(false);
      return;
    }

    // If at end, restart from 0.
    if (currentIndex >= sceneCount - 1) {
      previewScene(0);
    }
    setPlaying(true);
  }, [playing, sceneCount, currentIndex, previewScene]);

  const handleStop = useCallback(() => {
    setPlaying(false);
    if (sceneCount > 0) {
      previewScene(0);
    } else {
      exitPreview();
    }
  }, [sceneCount, previewScene, exitPreview]);

  // Empty state
  if (sceneCount === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-ide-xs text-muted-foreground/50">
          No scenes — add narration triggers to generate scenes
        </span>
      </div>
    );
  }

  const activeScene = scenes[currentIndex];

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Transport controls */}
        <div className="flex items-center gap-0.5">
          <IconButton
            onClick={handleStop}
            label="Stop"
            disabled={status.kind !== "previewing-scene" && !playing}
          >
            <StopIcon />
          </IconButton>
          <IconButton onClick={handlePrev} label="Previous scene" disabled={currentIndex <= 0}>
            <PrevIcon />
          </IconButton>
          <IconButton onClick={handlePlayPause} label={playing ? "Pause" : "Play"}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <IconButton onClick={handleNext} label="Next scene" disabled={currentIndex >= sceneCount - 1}>
            <NextIcon />
          </IconButton>
        </div>

        {/* Scene counter */}
        <span className="text-ide-xs tabular-nums text-muted-foreground">
          Scene {currentIndex + 1} of {sceneCount}
        </span>

        <div className="flex-1" />

        {/* Full preview launcher (placeholder) */}
        <button
          className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-ide-xs font-medium text-muted-foreground transition-colors duration-fast focus-ring press hover:text-foreground hover:border-primary/30"
          onClick={() => {
            // Placeholder: launch full presentation player in the future
          }}
        >
          <ExpandIcon />
          Full Preview
        </button>
      </div>

      {/* Scene preview area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeScene ? (
          <SceneCard scene={activeScene} index={currentIndex} active />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-ide-xs text-muted-foreground/50">No scene selected</span>
          </div>
        )}
      </div>

      {/* Scene strip (thumbnail row) */}
      <div className="flex gap-1 overflow-x-auto py-0.5">
        {scenes.map((scene, i) => (
          <button
            key={i}
            onClick={() => {
              setPlaying(false);
              goToScene(i);
            }}
            className={`
              flex h-6 min-w-[48px] items-center justify-center rounded border px-1.5 text-ide-2xs tabular-nums transition-colors duration-fast
              focus-ring
              ${i === currentIndex
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/20"
              }
            `}
          >
            {i + 1}
            {scene.slots.length > 0 && (
              <span className="ml-0.5 opacity-50">/{scene.slots.length}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Icon button wrapper ---

function IconButton({
  onClick,
  label,
  disabled,
  children,
}: {
  readonly onClick: () => void;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast focus-ring disabled:opacity-30 hover:text-foreground"
      aria-label={label}
    >
      {children}
    </button>
  );
}

// --- Transport icons (14x14 SVGs, consistent with Toolbar style) ---

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" stroke="none">
      <path d="M4 2.5v9l7-4.5L4 2.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" stroke="none">
      <rect x="3" y="2" width="3" height="10" rx="0.5" />
      <rect x="8" y="2" width="3" height="10" rx="0.5" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" stroke="none">
      <rect x="3" y="3" width="8" height="8" rx="1" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 3L4.5 7l4 4" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 3L9.5 7l-4 4" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1h4v4M5 11H1V7" />
      <path d="M11 1L6.5 5.5M1 11l4.5-4.5" />
    </svg>
  );
}
