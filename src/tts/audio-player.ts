// HTMLAudioElement-based player for TTS audio.
//
// Uses HTMLAudioElement instead of AudioBufferSourceNode because the browser's
// built-in time-stretching (preservesPitch = true) gives us speed control
// without pitch shift. AudioBufferSourceNode.playbackRate is a tape-speed
// change — rate and pitch move together.
//
// Lifecycle: create → load (decode base64 → blob URL) → play ⇄ pause → ...
// Each load() replaces any previous audio. play()/pause() are idempotent.

export class AudioPlayer {
  private readonly audio = new Audio();
  private blobUrl: string | null = null;
  private loaded = false;

  constructor() {
    this.audio.preservesPitch = true;
  }

  /** Decode base64-encoded audio (WAV from TTS) into a blob URL and buffer it. */
  async load(base64: string): Promise<void> {
    this.stop();
    this.revokeBlobUrl();

    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([binary], { type: "audio/wav" });
    this.blobUrl = URL.createObjectURL(blob);
    this.audio.src = this.blobUrl;

    await new Promise<void>((resolve, reject) => {
      this.audio.addEventListener(
        "canplaythrough",
        () => resolve(),
        { once: true },
      );
      this.audio.addEventListener(
        "error",
        () => reject(new Error("audio decode failed")),
        { once: true },
      );
      this.audio.load();
    });

    this.loaded = true;
  }

  /** Start or resume playback. */
  play(): void {
    if (!this.loaded) return;
    this.audio.play().catch(() => {});
  }

  /** Pause playback. Position is retained for resume. */
  pause(): void {
    if (!this.loaded) return;
    this.audio.pause();
  }

  /** Stop and reset to beginning. Always pauses even if not fully loaded. */
  stop(): void {
    this.audio.pause();
    if (this.loaded) this.audio.currentTime = 0;
  }

  /** Current content position in milliseconds. Unaffected by playback rate. */
  currentTimeMs(): number {
    return this.audio.currentTime * 1000;
  }

  /** Duration of loaded audio in milliseconds. */
  durationMs(): number {
    const d = this.audio.duration;
    return (Number.isFinite(d) ? d : 0) * 1000;
  }

  /** Set playback speed. preservesPitch keeps the voice natural.
   *  Sets defaultPlaybackRate so the rate survives src changes (new step loads). */
  setRate(rate: number): void {
    this.audio.playbackRate = rate;
    this.audio.defaultPlaybackRate = rate;
  }

  /** Register callback for when playback reaches the end naturally. */
  onEnd(callback: () => void): void {
    this.audio.onended = callback;
  }

  get isPlaying(): boolean {
    return this.loaded && !this.audio.paused && !this.audio.ended;
  }

  private revokeBlobUrl(): void {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }
}
