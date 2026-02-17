import { useQuery } from "@tanstack/react-query";
import { synthesize, type SynthesisResult } from "./synthesize";

// Full-text TTS synthesis with caching.
// React Query caches by text content — identical narration skips synthesis entirely.

export function useTTS(text: string) {
  const { data, isLoading, error } = useQuery<SynthesisResult>({
    queryKey: ["tts", text] as const,
    queryFn: () => synthesize(text),
    staleTime: Infinity,
    enabled: text.length > 0,
  });

  return { data, isLoading, error: error ?? null };
}
