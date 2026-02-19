import { useMemo } from "react";
import { useTTS } from "@/tts/use-tts";
import { useCurrentStep, usePresentationStore } from "./store";

export type TtsStatus = "idle" | "loading" | "ready" | "error";

export function useTtsStatus(): TtsStatus {
  const step = useCurrentStep();
  const bundlePath = usePresentationStore((s) => s.bundlePath);
  const narrationText = useMemo(
    () => step?.narration.map((n) => n.text).join(" ") ?? "",
    [step],
  );
  const { data, isLoading, error } = useTTS(narrationText, bundlePath);

  if (narrationText.length === 0) return "idle";
  if (error) return "error";
  if (isLoading || !data) return "loading";
  return "ready";
}
