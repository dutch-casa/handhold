import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { courseList, courseManifest, courseReadStep } from "@/browser/tauri";
import { parseLesson } from "@/parser/parse-lesson";
import { synthesize, type SynthesisResult } from "./synthesize";

// Global background TTS generator.
//
// On mount: discovers every narration text across every installed course,
// then generates audio with bounded concurrency. Populates the same
// ["tts", text] React Query cache that useTTS reads — so when the user
// reaches any step, audio is already there.
//
// Priority: current course first (if viewing one), other courses after.
// Within a course, lessons are processed in order. All generation runs
// through queryClient.prefetchQuery, which deduplicates in-flight requests
// and skips anything already cached.

const MAX_CONCURRENT = 3;

type PrefetchItem = {
  readonly text: string;
  readonly bundlePath: string;
  readonly priority: number;
};

async function discoverAllNarrations(
  qc: QueryClient,
  signal: AbortSignal,
  currentCourseId: string | null,
): Promise<readonly PrefetchItem[]> {
  const courses = await qc.fetchQuery({
    queryKey: ["courses"],
    queryFn: courseList,
    staleTime: 60_000,
  });
  if (signal.aborted) return [];

  const items: PrefetchItem[] = [];

  // Sort: current course first, then alphabetical by title.
  const sorted = [...courses].sort((a, b) => {
    if (a.id === currentCourseId) return -1;
    if (b.id === currentCourseId) return 1;
    return a.title.localeCompare(b.title);
  });

  for (const course of sorted) {
    if (signal.aborted) return items;

    const basePriority = course.id === currentCourseId ? 0 : 100;
    const audioBundlePath = `${course.localPath}/audio`;

    let manifest;
    try {
      manifest = await qc.fetchQuery({
        queryKey: ["course-manifest", course.id],
        queryFn: () => courseManifest(course.id),
        staleTime: Infinity,
      });
    } catch {
      continue;
    }
    if (signal.aborted) return items;

    for (let stepIdx = 0; stepIdx < manifest.steps.length; stepIdx++) {
      if (signal.aborted) return items;
      const step = manifest.steps[stepIdx];
      if (!step || step.kind !== "lesson") continue;

      let content;
      try {
        content = await qc.fetchQuery({
          queryKey: ["course-step", course.id, step.path],
          queryFn: () => courseReadStep(course.id, step.path),
          staleTime: Infinity,
        });
      } catch {
        continue;
      }
      if (signal.aborted) return items;

      const lesson = parseLesson(content);
      for (const lessonStep of lesson.steps) {
        const text = lessonStep.narration.map((n) => n.text).join(" ");
        if (text.length === 0) continue;
        items.push({
          text,
          bundlePath: audioBundlePath,
          priority: basePriority + stepIdx,
        });
      }
    }
  }

  return items;
}

function drainQueue(
  items: readonly PrefetchItem[],
  qc: QueryClient,
  signal: AbortSignal,
) {
  // Deduplicate by text, keeping lowest priority.
  const byText = new Map<string, PrefetchItem>();
  for (const item of items) {
    const existing = byText.get(item.text);
    if (!existing || item.priority < existing.priority) {
      byText.set(item.text, item);
    }
  }

  // Sort by priority, skip already-cached.
  const queue = [...byText.values()]
    .filter((item) => !qc.getQueryData<SynthesisResult>(["tts", item.text]))
    .sort((a, b) => a.priority - b.priority);

  let cursor = 0;
  let active = 0;

  const next = () => {
    while (active < MAX_CONCURRENT && cursor < queue.length) {
      if (signal.aborted) return;
      const item = queue[cursor]!;
      cursor++;

      // Double-check cache — may have been populated between discovery and drain.
      if (qc.getQueryData<SynthesisResult>(["tts", item.text])) {
        continue;
      }

      active++;
      qc.prefetchQuery({
        queryKey: ["tts", item.text] as const,
        queryFn: () => synthesize(item.text, item.bundlePath),
        staleTime: Infinity,
      }).finally(() => {
        active--;
        next();
      });
    }
  };

  next();
}

// Hook: call once in AppContent. Discovers and generates all TTS globally.
export function useGlobalTtsPrefetch(currentCourseId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    const controller = new AbortController();

    discoverAllNarrations(qc, controller.signal, currentCourseId)
      .then((items) => {
        if (!controller.signal.aborted) {
          drainQueue(items, qc, controller.signal);
        }
      })
      .catch(() => {});

    return () => { controller.abort(); };
  }, [qc, currentCourseId]);
}
