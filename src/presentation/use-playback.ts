import { useEffect, useMemo, useRef } from "react";
import { usePresentationStore, useCurrentStep } from "./store";
import { buildTimeline } from "./build-timeline";
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
// Plus background prefetch: while step N plays, synthesize step N+1 via useTTS.

export function usePlayback() {
  const step = useCurrentStep();

  // --- Player: created once, onEnd wired via getState (always fresh, no stale closure). ---
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

  const narrationText = step?.narration.map((n) => n.text).join(" ") ?? "";
  const bundlePath = usePresentationStore((s) => s.bundlePath);
  const { data: synthesis } = useTTS(narrationText, bundlePath);

  const timeline = useMemo(() => {
    if (!synthesis || !step) return [];
    return buildTimeline(synthesis, step);
  }, [synthesis, step]);

  // Bridge 1: Synthesis data → player.load(). Auto-plays if store is already "playing".
  // Cleanup stops the player when narration changes so old audio doesn't bleed into new steps.
  const loadedTextRef = useRef("");
  useEffect(() => {
    if (!synthesis || loadedTextRef.current === narrationText) return;
    loadedTextRef.current = narrationText;
    let cancelled = false;
    const player = playerRef.current!;
    player.stop();
    player.load(synthesis.audioBase64).then(() => {
      if (cancelled) return;
      if (usePresentationStore.getState().status === "playing") {
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

  // Bridge 3: Store → player/scheduler. Single subscribe replaces multiple useEffects.
  useEffect(() => {
    return usePresentationStore.subscribe((state, prev) => {
      const player = playerRef.current;
      const scheduler = schedulerRef.current;
      if (!player) return;

      if (state.status !== prev.status) {
        switch (state.status) {
          case "playing":
            player.play();
            scheduler?.play(player.currentTimeMs());
            break;
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

  // Prefetch: declaratively synthesize next step's TTS while current step plays.
  // useTTS is a React Query hook — result is cached, so advancing is instant.
  const nextNarrationText = usePresentationStore((s) => {
    const next = s.steps[s.currentStepIndex + 1];
    if (!next) return "";
    return next.narration.map((n) => n.text).join(" ");
  });
  useTTS(nextNarrationText, bundlePath);
}
