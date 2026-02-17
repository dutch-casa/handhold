import type { TimelineEvent } from "./build-timeline";

// Schedules timeline events using setTimeout with a sliding lookahead window.
//
// Invariants:
//   - Events fire in timeline order (sorted by timeMs at construction).
//   - Each event fires exactly once per play cycle.
//   - Pause cancels all pending timers; resume replays from the paused position.
//   - dispose() is terminal — no further calls are valid after it.
//
// Why setTimeout over rAF: events are discrete state transitions, not per-frame work.
// Why a lookahead window (~500ms) instead of scheduling all at once:
//   keeps the pending timer set small, makes pause cancellation O(window) not O(n).

const LOOKAHEAD_MS = 500;

type SchedulerState =
  | { readonly status: "idle" }
  | { readonly status: "playing"; readonly startWallTime: number }
  | { readonly status: "paused"; readonly elapsedMs: number }
  | { readonly status: "disposed" };

export class EventScheduler {
  private readonly timeline: readonly TimelineEvent[];
  private readonly onEvent: (event: TimelineEvent) => void;
  private state: SchedulerState = { status: "idle" };
  private nextIndex = 0;
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  rate = 1;

  constructor(
    timeline: readonly TimelineEvent[],
    onEvent: (event: TimelineEvent) => void,
  ) {
    this.timeline = timeline;
    this.onEvent = onEvent;
  }

  play(fromMs: number): void {
    if (this.state.status === "disposed") return;

    this.cancelAllTimers();
    this.nextIndex = this.findStartIndex(fromMs);
    // Anchor so that wallElapsed * rate = fromMs at this instant.
    this.state = { status: "playing", startWallTime: performance.now() - fromMs / this.rate };
    this.scheduleWindow();
  }

  pause(): number {
    if (this.state.status !== "playing") return 0;

    const elapsedMs = performance.now() - this.state.startWallTime;
    this.cancelAllTimers();
    this.state = { status: "paused", elapsedMs };
    return elapsedMs;
  }

  stop(): void {
    if (this.state.status === "disposed") return;

    this.cancelAllTimers();
    this.nextIndex = 0;
    this.state = { status: "idle" };
  }

  dispose(): void {
    this.cancelAllTimers();
    this.state = { status: "disposed" };
  }

  // --- Private ---

  // Binary search for the first event at or after the given time.
  private findStartIndex(fromMs: number): number {
    let lo = 0;
    let hi = this.timeline.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const event = this.timeline[mid];
      if (event && event.timeMs < fromMs) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  // Schedule events within the next LOOKAHEAD_MS window.
  // The last event in the window triggers scheduling the next window.
  // Timeline events are in content-time; delays are scaled by 1/rate for wall-time.
  private scheduleWindow(): void {
    if (this.state.status !== "playing") return;

    const now = performance.now();
    const wallElapsed = now - this.state.startWallTime;
    const contentElapsed = wallElapsed * this.rate;
    const contentWindowEnd = contentElapsed + LOOKAHEAD_MS * this.rate;
    let lastScheduledIndex = -1;

    while (this.nextIndex < this.timeline.length) {
      const event = this.timeline[this.nextIndex];
      if (!event) break;
      if (event.timeMs > contentWindowEnd) break;

      const delay = Math.max(0, (event.timeMs - contentElapsed) / this.rate);
      const index = this.nextIndex;

      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        this.onEvent(event);

        // If this was the last event in the window, schedule the next window.
        if (index === lastScheduledIndex) {
          this.scheduleWindow();
        }
      }, delay);

      this.pendingTimers.add(timer);
      lastScheduledIndex = index;
      this.nextIndex++;
    }

    // If no events were scheduled but there are future events, schedule a
    // wake-up at the start of the next window to keep advancing.
    if (lastScheduledIndex === -1 && this.nextIndex < this.timeline.length) {
      const nextEvent = this.timeline[this.nextIndex];
      if (nextEvent) {
        const delay = Math.max(0, (nextEvent.timeMs - contentElapsed) / this.rate);
        const timer = setTimeout(() => {
          this.pendingTimers.delete(timer);
          this.scheduleWindow();
        }, delay);
        this.pendingTimers.add(timer);
      }
    }
  }

  private cancelAllTimers(): void {
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
  }
}
