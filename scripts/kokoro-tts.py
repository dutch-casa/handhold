#!/usr/bin/env python3
"""Kokoro TTS bridge: text on stdin, raw int16 PCM on stdout at 24000 Hz mono.

Usage: echo "Hello" | python3 kokoro-tts.py <model_dir> [voice] [speed]

Exits with code 1 on error, writing diagnostics to stderr.
"""
import sys
import struct
import numpy as np

def main():
    if len(sys.argv) < 2:
        print("Usage: kokoro-tts.py <model_dir> [voice] [speed]", file=sys.stderr)
        sys.exit(1)

    model_dir = sys.argv[1]
    voice = sys.argv[2] if len(sys.argv) > 2 else "bf_emma"
    speed = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0

    from kokoro_onnx import Kokoro

    model_path = f"{model_dir}/kokoro-v1.0.onnx"
    voices_path = f"{model_dir}/voices-v1.0.bin"

    kokoro = Kokoro(model_path, voices_path)

    text = sys.stdin.read().strip()
    if not text:
        sys.exit(0)

    samples, sample_rate = kokoro.create(text, voice=voice, speed=speed)

    # Convert float32 [-1, 1] to int16 PCM and write to stdout.
    pcm = (samples * 32767).astype(np.int16)
    sys.stdout.buffer.write(pcm.tobytes())

    # Write sample rate to stderr so the caller knows the format.
    print(f"sample_rate={sample_rate}", file=sys.stderr)

if __name__ == "__main__":
    main()
