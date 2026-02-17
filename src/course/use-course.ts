import { useState } from "react";
import type { Course, CourseStep } from "@/types/course";

export type CourseNav = {
  readonly title: string;
  readonly steps: readonly CourseStep[];
  readonly currentIndex: number;
  readonly step: CourseStep;
  readonly progress: { readonly current: number; readonly total: number };
  readonly canNext: boolean;
  readonly canPrev: boolean;
  readonly next: () => void;
  readonly prev: () => void;
  readonly goTo: (index: number) => void;
};

export function useCourse(course: Course): CourseNav {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { steps, title } = course;
  const step = steps[currentIndex]!;
  const total = steps.length;

  return {
    title,
    steps,
    currentIndex,
    step,
    progress: { current: currentIndex + 1, total },
    canNext: currentIndex < total - 1,
    canPrev: currentIndex > 0,
    next: () => setCurrentIndex((i) => Math.min(i + 1, total - 1)),
    prev: () => setCurrentIndex((i) => Math.max(i - 1, 0)),
    goTo: (index) => setCurrentIndex(Math.max(0, Math.min(index, total - 1))),
  };
}
