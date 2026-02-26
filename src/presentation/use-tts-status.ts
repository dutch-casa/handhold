import { useEffect, useMemo, useRef, useState } from "react";
import { useTTS } from "@/tts/use-tts";
import { useCurrentStep, usePresentationStore } from "./store";

export type TtsStatus = "idle" | "loading" | "ready" | "error";

const LOADING_DEBOUNCE_MS = 400;

export function useTtsStatus(): TtsStatus {
  const step = useCurrentStep();
  const bundlePath = usePresentationStore((s) => s.bundlePath);
  const narrationText = useMemo(
    () => step?.narration.map((n) => n.text).join(" ") ?? "",
    [step],
  );
  const { data, isLoading, error } = useTTS(narrationText, bundlePath);

  const rawLoading = narrationText.length > 0 && !error && (isLoading || !data);

  // Debounce: only report "loading" after sustained waiting (400ms).
  // Cache hits resolve in <50ms and never show the overlay.
  const [debouncedLoading, setDebouncedLoading] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rawLoading) {
      timerRef.current = setTimeout(
        () => setDebouncedLoading(true),
        LOADING_DEBOUNCE_MS,
      );
    } else {
      setDebouncedLoading(false);
    }
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [rawLoading]);

  if (narrationText.length === 0) return "idle";
  if (error) return "error";
  if (debouncedLoading) return "loading";
  if (!rawLoading) return "ready";
  return "idle";
}
