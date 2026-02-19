import type { TimelineEvent } from "./build-timeline";

// Given a content-time position and a sorted timeline, return the scene/word
// index that should be active. Linear scan — fine for dozens of events per step.

export function resolveSceneAt(
  timeMs: number,
  timeline: readonly TimelineEvent[],
): number {
  let scene = 0;
  for (const event of timeline) {
    if (event.timeMs > timeMs) break;
    if (event.kind === "scene") scene = event.sceneIndex;
  }
  return scene;
}

export function resolveWordAt(
  timeMs: number,
  timeline: readonly TimelineEvent[],
): number {
  let word = -1;
  for (const event of timeline) {
    if (event.timeMs > timeMs) break;
    if (event.kind === "word") word = event.wordIndex;
  }
  return word;
}
