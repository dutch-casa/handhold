import { invoke, Channel } from "@tauri-apps/api/core";

// --- TTS Event types matching the Rust enum ---

export type WordBoundaryEvent = {
  readonly event: "wordBoundary";
  readonly data: {
    readonly word: string;
    readonly wordIndex: number;
    readonly charOffset: number;
    readonly startMs: number;
    readonly endMs: number;
  };
};

export type AudioReadyEvent = {
  readonly event: "audioReady";
  readonly data: {
    readonly audioBase64: string;
    readonly durationMs: number;
  };
};

export type TTSEvent = WordBoundaryEvent | AudioReadyEvent;

// --- Synthesis result ---

export type WordTiming = {
  readonly word: string;
  readonly wordIndex: number;
  readonly charOffset: number;
  readonly startMs: number;
  readonly endMs: number;
};

export type SynthesisResult = {
  readonly wordTimings: readonly WordTiming[];
  readonly audioBase64: string;
  readonly durationMs: number;
};

// --- Public API ---
// Invoke the Rust TTS backend and collect all events into a structured result.

// Prevent Tauri "Couldn't find callback id" warnings by holding a strong
// reference to every in-flight Channel until the Rust command finishes.
// Without this, React Query cancellation can GC the Channel while koko
// subprocesses are still running, causing Rust to send to a dead callback ID.
const liveChannels = new Set<Channel<TTSEvent>>();

export async function synthesize(
  text: string,
  bundlePath?: string,
): Promise<SynthesisResult> {
  const onEvent = new Channel<TTSEvent>();
  liveChannels.add(onEvent);

  const invokePromise = invoke("synthesize", {
    text,
    bundlePath: bundlePath ?? null,
    onEvent,
  });
  invokePromise.finally(() => { liveChannels.delete(onEvent); });

  return new Promise((resolve, reject) => {
    const wordTimings: WordTiming[] = [];
    let audioBase64 = "";
    let durationMs = 0;

    onEvent.onmessage = (event) => {
      switch (event.event) {
        case "wordBoundary":
          wordTimings.push({
            word: event.data.word,
            wordIndex: event.data.wordIndex,
            charOffset: event.data.charOffset,
            startMs: event.data.startMs,
            endMs: event.data.endMs,
          });
          break;

        case "audioReady":
          audioBase64 = event.data.audioBase64;
          durationMs = event.data.durationMs;
          resolve({ wordTimings, audioBase64, durationMs });
          break;
      }
    };

    invokePromise.catch(reject);
  });
}

/// Batch-export audio for all texts into a bundle directory. Returns count of newly exported.
export async function exportAudio(
  texts: readonly string[],
  bundleDir: string,
): Promise<number> {
  return invoke<number>("export_audio", { texts: [...texts], bundleDir });
}
