import { useEffect, useRef, useCallback } from "react";
import { usePresentationStore } from "./store";
import type { AudioPlayer } from "@/tts/audio-player";
import { colors, radii } from "@/app/theme";

// Single-step scrub bar. Tracks the current step's audio position via rAF
// and seeks within that step on pointer-up. No cross-step seeking.

type ScrubBarProps = {
  readonly playerRef: React.RefObject<AudioPlayer | null>;
  readonly onSeek: (ms: number) => void;
};

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 12;

export function ScrubBar({ playerRef, onSeek }: ScrubBarProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const rafRef = useRef(0);

  const setVisualPct = useCallback((pct: number) => {
    const clamped = `${Math.min(100, Math.max(0, pct))}%`;
    if (fillRef.current) fillRef.current.style.width = clamped;
    if (thumbRef.current) thumbRef.current.style.left = clamped;
  }, []);

  // rAF loop: read player position imperatively while playing.
  useEffect(() => {
    function tick() {
      if (!isDragging.current) {
        const player = playerRef.current;
        if (player) {
          const dur = player.durationMs();
          const pct = dur > 0 ? (player.currentTimeMs() / dur) * 100 : 0;
          setVisualPct(pct);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function start() {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }

    function stop() {
      cancelAnimationFrame(rafRef.current);
      // Final position snapshot so the bar doesn't freeze mid-track.
      const player = playerRef.current;
      if (player) {
        const dur = player.durationMs();
        setVisualPct(dur > 0 ? (player.currentTimeMs() / dur) * 100 : 0);
      }
    }

    if (usePresentationStore.getState().status === "playing") start();

    const unsub = usePresentationStore.subscribe((state, prev) => {
      if (state.status === prev.status) return;
      if (state.status === "playing") start();
      else stop();
    });

    return () => {
      unsub();
      cancelAnimationFrame(rafRef.current);
    };
  }, [playerRef, setVisualPct]);

  // Reset bar to 0 when the step changes.
  useEffect(() => {
    return usePresentationStore.subscribe((state, prev) => {
      if (state.currentStepIndex !== prev.currentStepIndex) {
        setVisualPct(0);
      }
    });
  }, [setVisualPct]);

  const handlePointerDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleInput = useCallback(
    (e: React.InputEvent<HTMLInputElement>) => {
      const val = Number(e.currentTarget.value);
      setVisualPct(val);
    },
    [setVisualPct],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      isDragging.current = false;
      const pct = Number(e.target.value);
      const player = playerRef.current;
      if (!player) return;
      const ms = (pct / 100) * player.durationMs();
      onSeek(ms);
    },
    [playerRef, onSeek],
  );

  return (
    <div style={containerStyle}>
      <div style={trackStyle}>
        <div ref={fillRef} style={fillStyle} />
      </div>
      <div ref={thumbRef} style={thumbStyle} />
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        defaultValue={0}
        tabIndex={-1}
        aria-label="Scrub through step"
        onPointerDown={handlePointerDown}
        onInput={handleInput}
        onChange={handleChange}
        style={rangeStyle}
      />
    </div>
  );
}

// --- Styles ---

const containerStyle: React.CSSProperties = {
  flex: 1,
  position: "relative",
  height: THUMB_SIZE + 8,
  display: "flex",
  alignItems: "center",
  minWidth: 60,
};

const trackStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  height: TRACK_HEIGHT,
  borderRadius: radii.sm,
  background: colors.border,
  overflow: "hidden",
};

const fillStyle: React.CSSProperties = {
  height: "100%",
  width: "0%",
  background: colors.accent,
  borderRadius: radii.sm,
};

const thumbStyle: React.CSSProperties = {
  position: "absolute",
  left: "0%",
  top: "50%",
  width: THUMB_SIZE,
  height: THUMB_SIZE,
  borderRadius: "50%",
  background: colors.accent,
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  zIndex: 2,
};

const rangeStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
  margin: 0,
};
