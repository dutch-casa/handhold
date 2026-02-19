import { useEffect, useRef } from "react";
import useMeasure from "react-use-measure";
import { usePresentationStore } from "./store";
import { useTtsStatus } from "./use-tts-status";
import { usePlayback } from "./use-playback";
import { useSound } from "@/sound/use-sound";
import { Sidebar } from "./Sidebar";
import { Stage } from "./Stage";
import { NarrationText } from "./NarrationText";
import { Controls } from "./Controls";
import type { ParsedLesson } from "@/types/lesson";
import { colors } from "@/app/theme";

const DESIGN_WIDTH = 1000;
const MIN_SCALE = 0.6;
const MAX_SCALE = 1.2;

type PresentationProps = {
  readonly lesson: ParsedLesson;
  readonly initialSlideIndex?: number | undefined;
  readonly completedSlideIds?: ReadonlySet<string> | undefined;
  readonly onSlideChange?: ((slideIndex: number) => void) | undefined;
  readonly onSlideComplete?: ((slideId: string) => void) | undefined;
  readonly onComplete?: (() => void) | undefined;
  readonly onLessonComplete?: (() => void) | undefined;
  readonly bundlePath?: string | undefined;
};

export function Presentation({
  lesson, initialSlideIndex, completedSlideIds, onSlideChange,
  onSlideComplete, onComplete, onLessonComplete, bundlePath,
}: PresentationProps) {
  const togglePlayPause = usePresentationStore((s) => s.togglePlayPause);
  const nextStep = usePresentationStore((s) => s.nextStep);
  const prevStep = usePresentationStore((s) => s.prevStep);
  const { play } = useSound();
  const ttsStatus = useTtsStatus();

  const containerRef = useRef<HTMLDivElement>(null);
  const [measureRef, { width: containerW, height: containerH }] = useMeasure();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const onSlideChangeRef = useRef(onSlideChange);
  useEffect(() => {
    onSlideChangeRef.current = onSlideChange;
  }, [onSlideChange]);

  const onSlideCompleteRef = useRef(onSlideComplete);
  onSlideCompleteRef.current = onSlideComplete;

  const onLessonCompleteRef = useRef(onLessonComplete);
  onLessonCompleteRef.current = onLessonComplete;

  const isInitialLoad = useRef(true);
  useEffect(() => {
    const state = usePresentationStore.getState();
    const index = isInitialLoad.current
      ? (initialSlideIndex ?? 0)
      : state.currentStepIndex;
    const boundedIndex = Math.max(0, Math.min(index, lesson.steps.length - 1));
    state.loadLesson({
      lesson,
      initialStepIndex: boundedIndex,
      completedSlideIds,
      onStepChange: (...a) => onSlideChangeRef.current?.(...a),
      onSlideComplete: (...a) => onSlideCompleteRef.current?.(...a),
      onLessonComplete: () => onLessonCompleteRef.current?.(),
      bundlePath,
    });
    isInitialLoad.current = false;
  }, [lesson, initialSlideIndex, completedSlideIds, bundlePath]);

  usePlayback();

  // Auto-focus so keyboard events work immediately.
  useEffect(() => { containerRef.current?.focus(); }, []);

  function handleNext() {
    const { currentStepIndex, steps } = usePresentationStore.getState();
    if (currentStepIndex >= steps.length - 1) {
      onCompleteRef.current?.();
      return;
    }
    nextStep();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    switch (e.code) {
      case "Space": {
        e.preventDefault();
        const state = usePresentationStore.getState();
        const current = state.steps[state.currentStepIndex];

        if (state.status === "idle" && current && state.completedStepIds.has(current.id)) {
          const prevIdx = state.currentStepIndex;
          handleNext();
          if (usePresentationStore.getState().currentStepIndex !== prevIdx) {
            usePresentationStore.getState().play();
          }
        } else {
          togglePlayPause();
        }
        play("click");
        break;
      }
      case "ArrowRight":
        e.preventDefault();
        handleNext();
        play("click");
        break;
      case "ArrowLeft":
        e.preventDefault();
        prevStep();
        play("click");
        break;
    }
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Lesson presentation"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        display: "flex",
        height: "100%",
        background: colors.bg,
        color: colors.text,
        outline: "none",
      }}
    >
      <Sidebar />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div
          ref={measureRef}
          style={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <TtsStatusOverlay status={ttsStatus} />
          <ScaledContent containerWidth={containerW} containerHeight={containerH}>
            <Stage />
          </ScaledContent>
        </div>
        <NarrationText />
        <Controls onNext={handleNext} />
      </main>
    </div>
  );
}

function TtsStatusOverlay({ status }: { readonly status: "idle" | "loading" | "ready" | "error" }) {
  if (status === "idle" || status === "ready") return null;

  const label = status === "error" ? "Audio failed. Retry by reloading the step." : "Generating audio…";
  const sublabel = status === "error" ? "Check the TTS logs if this keeps happening." : "This can take a few seconds on first run.";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 10, 10, 0.6)",
        zIndex: 10,
        pointerEvents: "auto",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          alignItems: "center",
          padding: "18px 20px",
          borderRadius: "12px",
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          color: colors.text,
          minWidth: "240px",
        }}
      >
        {status === "loading" ? <SpinnerIcon /> : <WarningIcon />}
        <div style={{ fontSize: "14px", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "12px", color: colors.textMuted, textAlign: "center" }}>{sublabel}</div>
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2">
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="1s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.error} strokeWidth="2">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

function ScaledContent({ containerWidth, containerHeight, children }: {
  readonly containerWidth: number;
  readonly containerHeight: number;
  readonly children: React.ReactNode;
}) {
  const [contentRef, { height: naturalH }] = useMeasure();

  let scale = containerWidth > 0 ? containerWidth / DESIGN_WIDTH : 1;
  if (naturalH > 0 && containerHeight > 0) {
    scale = Math.min(scale, containerHeight / naturalH);
  }
  scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

  return (
    <div style={{
      width: containerWidth,
      height: containerHeight,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}>
      <div
        ref={contentRef}
        style={{
          width: DESIGN_WIDTH,
          flexShrink: 0,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
