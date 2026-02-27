import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { invoke } from "@tauri-apps/api/core";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { Presentation } from "@/presentation/Presentation";
import { parseLesson } from "@/parser/parse-lesson";
import { initSettings, useSettingsStore } from "@/lab/settings-store";
import { Browser } from "@/browser/Browser";
import { watchDir, coursesDirPath, courseSync } from "@/browser/tauri";
import { useRoute } from "@/browser/use-route";
import {
  useCourse,
  useCourseManifest,
  useCourseStep,
  useCompleteStep,
  useStepProgress,
  useSlidePosition,
  useSaveSlidePosition,
  useSlideCompletions,
  useSaveSlideCompletion,
  useLabData,
  useHomeDirPath,
} from "@/browser/use-courses";
import { parseLab } from "@/lab/parse-lab";
import { Lab } from "@/lab/Lab";
import { CourseNavBar } from "@/course/CourseNavBar";
import { DependencyModal } from "@/course/DependencyModal";
import { useGlobalTtsPrefetch } from "@/tts/use-prefetch-tts";
import { UpdateBanner } from "@/updater/UpdateBanner";
import type { CourseRecord, ManifestStep } from "@/types/browser";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: false,
    },
  },
});

function useCoursesDirWatcher() {
  const qc = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let cleanup: { dispose: () => void } | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const sync = async () => {
      const result = await courseSync();
      if (result.added > 0 || result.removed > 0) {
        qc.invalidateQueries({ queryKey: ["courses"] });
        qc.invalidateQueries({ queryKey: ["course-tags"] });
      }
    };

    const start = async () => {
      const dir = await coursesDirPath();
      await sync();
      cleanup = await watchDir(dir, () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => { sync().catch(() => {}); }, 500);
      });
      if (disposed && cleanup) cleanup.dispose();
    };

    start().catch((err) => {
      console.error("[courses-watcher] failed to start:", err);
    });

    return () => {
      disposed = true;
      if (debounce) clearTimeout(debounce);
      cleanup?.dispose();
    };
  }, [qc]);
}

function AppContent() {
  const { route, navigate } = useRoute();
  const [pendingImportUrl, setPendingImportUrl] = useState<string | null>(null);

  useCoursesDirWatcher();
  useGlobalTtsPrefetch(route.kind === "course" ? route.courseId : null);

  useEffect(() => {
    const promise = onOpenUrl((urls) => {
      for (const raw of urls) {
        let parsed: URL;
        try { parsed = new URL(raw); } catch { continue; }

        if (parsed.hostname === "import") {
          const url = parsed.searchParams.get("url");
          if (url) {
            navigate({ kind: "browser" });
            setPendingImportUrl(url);
          }
        } else if (parsed.hostname === "open") {
          const parts = parsed.pathname.split("/").filter(Boolean);
          const courseId = parts[0];
          if (!courseId) continue;
          const stepIndex = parts[1] ? parseInt(parts[1], 10) : 0;
          if (!Number.isNaN(stepIndex)) {
            navigate({ kind: "course", courseId, stepIndex });
          }
        }
      }
    });
    return () => { promise.then((fn) => fn()); };
  }, [navigate]);

  const { isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: initSettings,
    staleTime: Infinity,
  });

  // Trigger TTS model download in the background on app startup.
  // koko auto-downloads ~350MB of model files on first use — doing it early
  // means TTS is ready by the time the user hits play.
  useQuery({
    queryKey: ["tts-warmup"],
    queryFn: () => invoke<string>("ensure_tts_ready"),
    staleTime: Infinity,
    retry: false,
  });

  if (isLoading) return null;

  return (
    <div className="flex flex-col h-screen">
      <UpdateBanner />
      <div className="flex-1 min-h-0">
        {route.kind === "browser" ? (
          <Browser
            onOpen={(course: CourseRecord) =>
              navigate({ kind: "course", courseId: course.id, stepIndex: 0 })
            }
            initialImportUrl={pendingImportUrl ?? undefined}
            onImportHandled={() => setPendingImportUrl(null)}
          />
        ) : (
          <CourseShell
            key={route.courseId}
            courseId={route.courseId}
            onBack={() => navigate({ kind: "browser" })}
          />
        )}
      </div>
    </div>
  );
}

type CourseShellProps = {
  readonly courseId: string;
  readonly onBack: () => void;
};

function CourseShell({ courseId, onBack }: CourseShellProps) {
  const { data: manifest, isLoading } = useCourseManifest(courseId);
  const { data: course } = useCourse(courseId);
  const { data: progressIndices } = useStepProgress(courseId);
  const [rawStepIndex, setStepIndex] = useState(0);
  const completeStep = useCompleteStep();
  const stepIndexRef = useRef(rawStepIndex);
  const { data: homeDir = "/" } = useHomeDirPath();
  const [depsCleared, setDepsCleared] = useState(false);

  const completedSteps = useMemo(
    () => new Set(progressIndices ?? []),
    [progressIndices],
  );

  if (isLoading || !manifest) return null;

  const total = manifest.steps.length;
  // Clamp to valid range — prevents blank screen if batched updates overshoot.
  const stepIndex = Math.min(Math.max(0, rawStepIndex), total - 1);
  if (stepIndex !== rawStepIndex) setStepIndex(stepIndex);
  stepIndexRef.current = stepIndex;

  const currentStep = manifest.steps[stepIndex]!;
  const canNext = stepIndex < total - 1;
  const hasDeps = manifest.dependencies.length > 0;

  function handleNext() {
    setStepIndex((i) => (i + 1 < total ? i + 1 : i));
  }

  function handleStepComplete() {
    completeStep.mutate({ courseId, stepIndex: stepIndexRef.current });
  }

  return (
    <div className="flex h-full flex-col">
      {hasDeps && (
        <DependencyModal
          open={!depsCleared}
          deps={manifest.dependencies}
          homeDir={homeDir}
          onContinue={() => setDepsCleared(true)}
        />
      )}
      <CourseNavBar
        nav={{
          progress: { current: stepIndex + 1, total },
          canNext,
          canPrev: stepIndex > 0,
          next: handleNext,
          prev: () => setStepIndex((i) => (i > 0 ? i - 1 : 0)),
          stepTitle: currentStep.title,
          steps: manifest.steps,
          goTo: setStepIndex,
          completedSteps,
        }}
        onBack={onBack}
      />
      <div key={currentStep.path} className="flex-1 min-h-0">
        <StepView
          courseId={courseId}
          stepIndex={stepIndex}
          step={currentStep}
          onComplete={handleNext}
          onLessonComplete={handleStepComplete}
          audioBundlePath={course ? `${course.localPath}/audio` : undefined}
          coursePath={course?.localPath}
        />
      </div>
    </div>
  );
}

type StepViewProps = {
  readonly courseId: string;
  readonly stepIndex: number;
  readonly step: ManifestStep;
  readonly onComplete: () => void;
  readonly onLessonComplete: () => void;
  readonly audioBundlePath: string | undefined;
  readonly coursePath: string | undefined;
};

function StepView({ courseId, stepIndex, step, onComplete, onLessonComplete, audioBundlePath, coursePath }: StepViewProps) {
  switch (step.kind) {
    case "lesson":
      return (
        <LessonStep
          courseId={courseId}
          stepIndex={stepIndex}
          stepPath={step.path}
          onComplete={onComplete}
          onLessonComplete={onLessonComplete}
          audioBundlePath={audioBundlePath}
          coursePath={coursePath}
        />
      );
    case "lab":
      return (
        <LabStep
          courseId={courseId}
          stepPath={step.path}
          stepTitle={step.title}
        />
      );
  }
}

type LessonStepProps = {
  readonly courseId: string;
  readonly stepIndex: number;
  readonly stepPath: string;
  readonly onComplete: () => void;
  readonly onLessonComplete: () => void;
  readonly audioBundlePath: string | undefined;
  readonly coursePath: string | undefined;
};

function LessonStep({ courseId, stepIndex, stepPath, onComplete, onLessonComplete, audioBundlePath, coursePath }: LessonStepProps) {
  const { data: content, isLoading: contentLoading } = useCourseStep(courseId, stepPath);
  const { data: savedPosition, isLoading: positionLoading } = useSlidePosition(courseId, stepIndex);
  const { data: completedSlideIds, isLoading: completionsLoading } = useSlideCompletions(courseId, stepIndex);
  const savePosition = useSaveSlidePosition();
  const saveSlideCompletion = useSaveSlideCompletion();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!coursePath) return;
    if (stepPath.length === 0) return;
    const watchPath = `${coursePath.replace(/\/$/, "")}/${stepPath.replace(/^\//, "")}`;
    let disposed = false;
    let cleanup: { dispose: () => void } | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const queryKey = ["course-step", courseId, stepPath] as const;
    const arm = async () => {
      console.log("[watcher] arming →", watchPath);
      cleanup = await watchDir(watchPath, () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          console.log("[watcher] file changed, refetching", stepPath);
          queryClient.invalidateQueries({ queryKey });
          queryClient.refetchQueries({ queryKey });
        }, 100);
      });
      console.log("[watcher] armed ✓", watchPath);
      if (disposed && cleanup) cleanup.dispose();
    };
    arm().catch((err) => {
      console.error("[watcher] failed to arm:", watchPath, err);
    });
    return () => {
      disposed = true;
      if (debounce) clearTimeout(debounce);
      cleanup?.dispose();
    };
  }, [coursePath, courseId, stepPath, queryClient]);

  const lesson = useMemo(() => (content ? parseLesson(content) : null), [content]);
  useEffect(() => {
    if (!lesson || lesson.diagnostics.length === 0) return;
    const lines = lesson.diagnostics.map((d) => {
      const loc = d.location.kind === "lesson"
        ? "lesson"
        : d.location.kind === "step"
          ? `${d.location.stepTitle}`
          : d.location.kind === "paragraph"
            ? `${d.location.stepTitle} p${d.location.paragraphIndex + 1}`
            : `${d.location.stepTitle} p${d.location.paragraphIndex + 1} t${d.location.triggerIndex + 1}`;
      return `[${d.severity}] ${loc}: ${d.message}`;
    });
    console.warn("Lesson diagnostics:\n" + lines.join("\n"));
  }, [lesson]);

  const slideCount = lesson?.steps.length ?? 0;
  const handleSlideChange = useCallback(
    (slideIndex: number) => {
      savePosition.mutate({
        courseId,
        stepIndex,
        slideIndex,
        slideCount,
      });
    },
    [courseId, stepIndex, slideCount, savePosition],
  );

  const handleSlideComplete = useCallback(
    (slideId: string) => {
      saveSlideCompletion.mutate({ courseId, stepIndex, slideId });
    },
    [courseId, stepIndex, saveSlideCompletion],
  );

  const completedSet = useMemo(
    () => new Set(completedSlideIds ?? []),
    [completedSlideIds],
  );

  if (contentLoading || positionLoading || completionsLoading || !lesson) return null;

  return (
    <Presentation
      lesson={lesson}
      initialSlideIndex={savedPosition?.slideIndex}
      completedSlideIds={completedSet}
      onSlideChange={handleSlideChange}
      onSlideComplete={handleSlideComplete}
      onComplete={onComplete}
      onLessonComplete={onLessonComplete}
      bundlePath={audioBundlePath}
    />
  );
}

type LabStepProps = {
  readonly courseId: string;
  readonly stepPath: string;
  readonly stepTitle: string;
};

function LabStep({ courseId, stepPath, stepTitle }: LabStepProps) {
  const { data, isLoading } = useLabData(courseId, stepPath);

  const manifest = useMemo(() => {
    if (!data) return undefined;
    // Labs open with the instructions panel visible
    useSettingsStore.getState().setSidebarPanel("instructions");
    return parseLab(stepTitle, data);
  }, [stepTitle, data]);

  if (isLoading || !manifest || !data) return null;

  return <Lab manifest={manifest} workspacePath={data.workspacePath} />;
}

export function App() {
  return (
    <HotkeysProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </HotkeysProvider>
  );
}
