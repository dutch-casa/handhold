import { Howl } from "howler";
import { useCallback, useRef } from "react";

// Lazily-loaded sound effects via Howler.
// Each sound is created once and reused. No preloading — first play loads.
//
// Sounds are embedded as data URIs (tiny WAV/MP3) to avoid network requests.
// For now: click (short tick) and success (chime).

const SOUNDS = {
  click: createLazySound(clickDataUri()),
  success: createLazySound(successDataUri()),
  pulse: createLazySound(pulseDataUri()),
} as const;

type SoundName = keyof typeof SOUNDS;

// Imperative API for non-React contexts (store callbacks, event handlers).
export function playSound(name: SoundName): void {
  SOUNDS[name]().play();
}

export function useSound() {
  const enabledRef = useRef(true);

  const play = useCallback((name: SoundName) => {
    if (!enabledRef.current) return;
    SOUNDS[name]().play();
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  return { play, setEnabled };
}

// Create a function that lazily instantiates a Howl on first call.
function createLazySound(dataUri: string): () => Howl {
  let instance: Howl | null = null;
  return () => {
    if (!instance) {
      instance = new Howl({ src: [dataUri], volume: 0.3, preload: true });
    }
    return instance;
  };
}

// Tiny synthesized click sound as base64 WAV data URI.
// 44100Hz, mono, 16-bit, ~20ms duration.
function clickDataUri(): string {
  const sampleRate = 44100;
  const duration = 0.02;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Generate a short tick: high-frequency burst with fast decay
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 300);
    const sample = Math.sin(2 * Math.PI * 4000 * t) * envelope * 0.5;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

// Tiny synthesized success chime as base64 WAV data URI.
// Two ascending tones, ~150ms total.
function successDataUri(): string {
  const sampleRate = 44100;
  const duration = 0.15;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header (same structure)
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Two ascending tones with smooth crossfade
  const mid = numSamples / 2;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 15) * 0.4;
    const freq = i < mid ? 880 : 1320; // A5 → E6
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

// Satisfying pulse: warm fundamental with a harmonic shimmer.
// Quick swell in, smooth exponential decay, ~200ms.
function pulseDataUri(): string {
  const sampleRate = 44100;
  const duration = 0.2;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Quick attack (~10ms), smooth decay
    const attack = 1 - Math.exp(-t * 400);
    const decay = Math.exp(-t * 12);
    const envelope = attack * decay * 0.35;
    // Warm fundamental (G5) + soft octave harmonic for shimmer
    const fundamental = Math.sin(2 * Math.PI * 784 * t);
    const harmonic = Math.sin(2 * Math.PI * 1568 * t) * 0.3;
    const sample = (fundamental + harmonic) * envelope;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
