import { useEffect, useRef } from "react";
import useMeasure from "react-use-measure";
import { usePresentationStore } from "./store";
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
  readonly onSlideChange?: ((slideIndex: number) => void) | undefined;
  readonly onComplete?: (() => void) | undefined;
  readonly bundlePath?: string | undefined;
};

export function Presentation({ lesson, initialSlideIndex, onSlideChange, onComplete, bundlePath }: PresentationProps) {
  const togglePlayPause = usePresentationStore((s) => s.togglePlayPause);
  const nextStep = usePresentationStore((s) => s.nextStep);
  const prevStep = usePresentationStore((s) => s.prevStep);
  const { play } = useSound();

  const containerRef = useRef<HTMLDivElement>(null);
  const [measureRef, { width: containerW, height: containerH }] = useMeasure();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Lazy init — store updated synchronously before children render.
  // No useEffect, no wasted initial render with empty state.
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    usePresentationStore.getState().loadLesson(lesson, initialSlideIndex, onSlideChange, bundlePath);
    initializedRef.current = true;
  }

  usePlayback();

  // Auto-focus so keyboard events work immediately.
  useEffect(() => { containerRef.current?.focus(); }, []);

  function handleNext() {
    const { currentStepIndex, steps } = usePresentationStore.getState();
    if (currentStepIndex >= steps.length - 1) {
      nextStep();
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
