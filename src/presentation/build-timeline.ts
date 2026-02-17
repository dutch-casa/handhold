import type { LessonStep } from "@/types/lesson";
import type { SynthesisResult } from "@/tts/synthesize";

// Pure function: build the complete playback timeline from synthesis data and step triggers.
// The timeline is a sorted, immutable array of events — the single source of truth
// for what happens when during playback.

export type TimelineEvent =
  | { readonly timeMs: number; readonly kind: "word"; readonly wordIndex: number }
  | { readonly timeMs: number; readonly kind: "scene"; readonly sceneIndex: number };

export function buildTimeline(
  synthesis: SynthesisResult,
  step: LessonStep,
): readonly TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 1. Word events — one per word timing from synthesis
  for (const wt of synthesis.wordTimings) {
    events.push({ timeMs: wt.startMs, kind: "word", wordIndex: wt.wordIndex });
  }

  // 2. Assemble triggers from narration blocks with word offset accounting.
  const triggers: { wordIndex: number }[] = [];
  let wordOffset = 0;
  for (const block of step.narration) {
    for (const trigger of block.triggers) {
      triggers.push({ wordIndex: trigger.wordIndex + wordOffset });
    }
    wordOffset += block.text.split(/\s+/).filter(Boolean).length;
  }

  // 3. Map each trigger to a scene index (starting at 1, scene 0 is initial state)
  let sceneIdx = 1;
  for (const trigger of triggers) {
    const wordTiming = synthesis.wordTimings.find(
      (wt) => wt.wordIndex >= trigger.wordIndex,
    );
    const timeMs = wordTiming?.startMs ?? 0;
    events.push({ timeMs, kind: "scene", sceneIndex: sceneIdx });
    sceneIdx++;
  }

  // 4. Stable sort by time
  events.sort((a, b) => a.timeMs - b.timeMs);

  return events;
}
