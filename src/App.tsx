import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { invoke } from "@tauri-apps/api/core";
import { Presentation } from "@/presentation/Presentation";
import { parseLesson } from "@/parser/parse-lesson";
import { initSettings } from "@/lab/settings-store";
import { Browser } from "@/browser/Browser";
import { useRoute } from "@/browser/use-route";
import {
  useCourse,
  useCourseManifest,
  useCourseStep,
  useCompleteStep,
  useSlidePosition,
  useSaveSlidePosition,
  useLabData,
} from "@/browser/use-courses";
import { parseLab } from "@/lab/parse-lab";
import { Lab } from "@/lab/Lab";
import { CourseNavBar } from "@/course/CourseNavBar";
import type { CourseRecord, ManifestStep } from "@/types/browser";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: false,
    },
  },
});

function AppContent() {
  const { route, navigate } = useRoute();

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

  switch (route.kind) {
    case "browser":
      return (
        <Browser
          onOpen={(course: CourseRecord) =>
            navigate({ kind: "course", courseId: course.id, stepIndex: 0 })
          }
        />
      );
    case "course":
      return (
        <CourseShell
          key={route.courseId}
          courseId={route.courseId}
          onBack={() => navigate({ kind: "browser" })}
        />
      );
  }
}

type CourseShellProps = {
  readonly courseId: string;
  readonly onBack: () => void;
};

function CourseShell({ courseId, onBack }: CourseShellProps) {
  const { data: manifest, isLoading } = useCourseManifest(courseId);
  const { data: course } = useCourse(courseId);
  const [stepIndex, setStepIndex] = useState(0);
  const completeStep = useCompleteStep();

  if (isLoading || !manifest) return null;

  const currentStep = manifest.steps[stepIndex];
  if (!currentStep) return null;

  const total = manifest.steps.length;
  const canNext = stepIndex < total - 1;

  function handleNext() {
    completeStep.mutate({ courseId, stepIndex });
    if (canNext) setStepIndex((i) => i + 1);
  }

  return (
    <div className="flex h-screen flex-col">
      <CourseNavBar
        nav={{
          progress: { current: stepIndex + 1, total },
          canNext,
          canPrev: stepIndex > 0,
          next: handleNext,
          prev: () => setStepIndex((i) => Math.max(i - 1, 0)),
          stepTitle: currentStep.title,
        }}
        onBack={onBack}
      />
      <div key={stepIndex} className="flex-1 min-h-0">
        <StepView courseId={courseId} stepIndex={stepIndex} step={currentStep} onComplete={handleNext} audioBundlePath={course ? `${course.localPath}/audio` : undefined} />
      </div>
    </div>
  );
}

type StepViewProps = {
  readonly courseId: string;
  readonly stepIndex: number;
  readonly step: ManifestStep;
  readonly onComplete: () => void;
  readonly audioBundlePath: string | undefined;
};

function StepView({ courseId, stepIndex, step, onComplete, audioBundlePath }: StepViewProps) {
  switch (step.kind) {
    case "lesson":
      return (
        <LessonStep
          courseId={courseId}
          stepIndex={stepIndex}
          stepPath={step.path}
          onComplete={onComplete}
          audioBundlePath={audioBundlePath}
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
  readonly audioBundlePath: string | undefined;
};

function LessonStep({ courseId, stepIndex, stepPath, onComplete, audioBundlePath }: LessonStepProps) {
  const { data: content, isLoading: contentLoading } = useCourseStep(courseId, stepPath);
  const { data: savedPosition, isLoading: positionLoading } = useSlidePosition(courseId, stepIndex);
  const savePosition = useSaveSlidePosition();

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

  if (contentLoading || positionLoading || !lesson) return null;
  return (
    <Presentation
      lesson={lesson}
      initialSlideIndex={savedPosition?.slideIndex}
      onSlideChange={(slideIndex) =>
        savePosition.mutate({
          courseId,
          stepIndex,
          slideIndex,
          slideCount: lesson.steps.length,
        })
      }
      onComplete={onComplete}
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

  const manifest = useMemo(
    () => data ? parseLab(stepTitle, data) : undefined,
    [stepTitle, data],
  );

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
