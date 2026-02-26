import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePresentationStore, useCurrentStep } from "./store";
import { buildTimeline, type TimelineEvent } from "./build-timeline";
import { resolveSceneAt, resolveWordAt } from "./resolve-scene-at";
import { EventScheduler } from "./event-scheduler";
import { AudioPlayer } from "@/tts/audio-player";
import { useTTS } from "@/tts/use-tts";
import { playSound } from "@/sound/use-sound";

// Playback orchestrator. Bridges TTS audio, timeline scheduler, and store.
//
// Three imperative bridges, each with a clear trigger:
//   1. Synthesis data arrives → load audio into player (useEffect on query data).
//   2. Timeline changes       → create/dispose scheduler (useEffect on derived memo).
//   3. Store state changes     → sync player/scheduler (zustand subscribe, not useEffect).
//
// Sync invariant: Bridge 3 only starts playback when the loaded audio matches
// the current narration text. On step transitions, the audio is stale until
// Bridge 1 finishes loading. Bridge 1 auto-plays if status is "playing".
//
// Global TTS prefetch lives in useGlobalTtsPrefetch (AppContent level).

export type UsePlaybackResult = {
  readonly playerRef: React.RefObject<AudioPlayer | null>;
  readonly seekLocal: (ms: number) => void;
};

export function usePlayback(): UsePlaybackResult {
  const step = useCurrentStep();

  const playerRef = useRef<AudioPlayer | null>(null);
  if (!playerRef.current) {
    const player = new AudioPlayer();
    player.onEnd(() => {
      const s = usePresentationStore.getState();
      const current = s.steps[s.currentStepIndex];
      if (current) s.markStepComplete(current.id);
      usePresentationStore.setState({ status: "idle" });
      playSound("pulse");
    });
    playerRef.current = player;
  }

  const schedulerRef = useRef<EventScheduler | null>(null);
  const timelineRef = useRef<readonly TimelineEvent[]>([]);

  // Tracks which narration the player has actually loaded audio for.
  // Bridge 3 gates playback on this matching the current narration text.
  const readyTextRef = useRef("");

  const narrationText = step?.narration.map((n) => n.text).join(" ") ?? "";
  const narrationTextRef = useRef(narrationText);
  narrationTextRef.current = narrationText;

  const bundlePath = usePresentationStore((s) => s.bundlePath);
  const { data: synthesis } = useTTS(narrationText, bundlePath);

  const timeline = useMemo(() => {
    if (!synthesis || !step) return [];
    return buildTimeline(synthesis, step);
  }, [synthesis, step]);

  timelineRef.current = timeline;

  // Seek within the current step: reposition audio, resolve scene/word, restart scheduler.
  const seekLocal = useCallback((ms: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.seekMs(ms);

    const tl = timelineRef.current;
    const { setSceneIndex, setWordIndex } = usePresentationStore.getState();
    setSceneIndex(resolveSceneAt(ms, tl));
    setWordIndex(resolveWordAt(ms, tl));

    const scheduler = schedulerRef.current;
    if (scheduler && usePresentationStore.getState().status === "playing") {
      scheduler.play(ms);
    }
  }, []);

  // Bridge 1: Synthesis data → player.load(). Auto-plays if store is already "playing".
  useEffect(() => {
    if (!synthesis) return;

    // Mark audio as not ready for the new text until load completes.
    readyTextRef.current = "";

    let cancelled = false;
    const player = playerRef.current!;
    player.stop();
    player.load(synthesis.audioBase64).then(() => {
      if (cancelled) return;
      readyTextRef.current = narrationText;

      const { status, playbackRate } = usePresentationStore.getState();
      player.setRate(playbackRate);

      if (status === "playing") {
        player.play();
        schedulerRef.current?.play(player.currentTimeMs());
      }
    }).catch(console.error);
    return () => {
      cancelled = true;
      player.stop();
    };
  }, [synthesis, narrationText]);

  // Bridge 2: Timeline → scheduler creation/disposal.
  useEffect(() => {
    if (timeline.length === 0) {
      schedulerRef.current = null;
      return;
    }
    const { setWordIndex, setSceneIndex, playbackRate } =
      usePresentationStore.getState();

    const scheduler = new EventScheduler(timeline, (event) => {
      switch (event.kind) {
        case "word":
          setWordIndex(event.wordIndex);
          break;
        case "scene":
          setSceneIndex(event.sceneIndex);
          break;
      }
    });
    scheduler.rate = playbackRate;
    schedulerRef.current = scheduler;
    return () => scheduler.dispose();
  }, [timeline]);

  // Bridge 3: Store → player/scheduler.
  // Only plays when readyTextRef matches the current narration — prevents
  // firing a stale scheduler from the previous step during transitions.
  useEffect(() => {
    return usePresentationStore.subscribe((state, prev) => {
      const player = playerRef.current;
      const scheduler = schedulerRef.current;
      if (!player) return;

      if (state.status !== prev.status) {
        switch (state.status) {
          case "playing": {
            const audioReady = readyTextRef.current === narrationTextRef.current;
            if (audioReady) {
              player.play();
              scheduler?.play(player.currentTimeMs());
            }
            // If not ready, Bridge 1 will start playback when audio loads.
            break;
          }
          case "paused":
            player.pause();
            scheduler?.pause();
            break;
          case "idle":
            player.stop();
            scheduler?.stop();
            break;
        }
      }

      if (state.playbackRate !== prev.playbackRate) {
        player.setRate(state.playbackRate);
        if (scheduler) {
          scheduler.rate = state.playbackRate;
          if (state.status === "playing") {
            scheduler.play(player.currentTimeMs());
          }
        }
      }
    });
  }, []);

  return { playerRef, seekLocal };
}
