// Course IR — a linear sequence of lessons (watch) and labs (do).

import type { ParsedLesson } from "@/types/lesson";
import type { ParsedLab } from "@/types/lab";

export type CourseStep =
  | { readonly kind: "lesson"; readonly title: string; readonly lesson: ParsedLesson }
  | { readonly kind: "lab"; readonly title: string; readonly lab: ParsedLab };

export type Course = {
  readonly title: string;
  readonly steps: readonly CourseStep[];
};
