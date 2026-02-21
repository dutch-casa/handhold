import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/browser/tauri";

const KEYS = {
  courses: ["courses"] as const,
  course: (id: string) => ["course", id] as const,
  manifest: (id: string) => ["course-manifest", id] as const,
  step: (id: string, path: string) => ["course-step", id, path] as const,
  tags: ["course-tags"] as const,
  search: (q: string) => ["course-search", q] as const,
  byTag: (t: string) => ["courses-by-tag", t] as const,
  progress: (id: string) => ["step-progress", id] as const,
  slidePosition: (id: string, step: number) => ["slide-position", id, step] as const,
  slideCompletions: (id: string, step: number) => ["slide-completions", id, step] as const,
  labData: (id: string, path: string) => ["lab-data", id, path] as const,
} as const;

export function useCourse(id: string) {
  return useQuery({
    queryKey: KEYS.course(id),
    queryFn: () => api.courseGet(id),
  });
}

export function useCourseManifest(id: string) {
  return useQuery({
    queryKey: KEYS.manifest(id),
    queryFn: () => api.courseManifest(id),
    staleTime: Infinity,
  });
}

export function useCourseStep(courseId: string, stepPath: string) {
  return useQuery({
    queryKey: KEYS.step(courseId, stepPath),
    queryFn: () => api.courseReadStep(courseId, stepPath),
    staleTime: Infinity,
    enabled: stepPath.length > 0,
  });
}

export function useCourses() {
  return useQuery({
    queryKey: KEYS.courses,
    queryFn: api.courseList,
  });
}

export function useCourseTags() {
  return useQuery({
    queryKey: KEYS.tags,
    queryFn: api.courseTags,
  });
}

export function useCourseSearch(query: string) {
  return useQuery({
    queryKey: KEYS.search(query),
    queryFn: () => api.courseSearch(query),
    enabled: query.length > 0,
  });
}

export function useCoursesByTag(tag: string) {
  return useQuery({
    queryKey: KEYS.byTag(tag),
    queryFn: () => api.courseByTag(tag),
    enabled: tag.length > 0,
  });
}

export function useStepProgress(courseId: string) {
  return useQuery({
    queryKey: KEYS.progress(courseId),
    queryFn: () => api.stepProgress(courseId),
  });
}

export function useImportCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.courseImport,
    onSuccess: (result) => {
      if (result.kind === "ok") {
        qc.invalidateQueries({ queryKey: KEYS.courses });
        qc.invalidateQueries({ queryKey: KEYS.tags });
      }
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteWorkspaces }: { id: string; deleteWorkspaces: boolean }) =>
      api.courseDelete(id, deleteWorkspaces),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.courses });
      qc.invalidateQueries({ queryKey: KEYS.tags });
    },
  });
}

export function useSlidePosition(courseId: string, stepIndex: number) {
  return useQuery({
    queryKey: KEYS.slidePosition(courseId, stepIndex),
    queryFn: () => api.slidePositionLoad(courseId, stepIndex),
    staleTime: Infinity,
  });
}

export function useSaveSlidePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      stepIndex,
      slideIndex,
      slideCount,
    }: {
      courseId: string;
      stepIndex: number;
      slideIndex: number;
      slideCount: number | null;
    }) => api.slidePositionSave(courseId, stepIndex, slideIndex, slideCount),
    onSuccess: (_, { courseId, stepIndex, slideIndex, slideCount }) => {
      qc.setQueryData(KEYS.slidePosition(courseId, stepIndex), { slideIndex, slideCount });
    },
  });
}

export function useSlideCompletions(courseId: string, stepIndex: number) {
  return useQuery({
    queryKey: KEYS.slideCompletions(courseId, stepIndex),
    queryFn: () => api.slideCompletions(courseId, stepIndex),
    staleTime: Infinity,
  });
}

export function useSaveSlideCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      stepIndex,
      slideId,
    }: {
      courseId: string;
      stepIndex: number;
      slideId: string;
    }) => api.slideComplete(courseId, stepIndex, slideId),
    onSuccess: (_, { courseId, stepIndex, slideId }) => {
      qc.setQueryData<string[]>(
        KEYS.slideCompletions(courseId, stepIndex),
        (prev) => prev ? [...prev, slideId] : [slideId],
      );
    },
  });
}

export function useLabData(courseId: string, stepPath: string) {
  return useQuery({
    queryKey: KEYS.labData(courseId, stepPath),
    queryFn: () => api.courseReadLab(courseId, stepPath),
    staleTime: Infinity,
    enabled: stepPath.length > 0,
  });
}

export function useCompleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, stepIndex }: { courseId: string; stepIndex: number }) =>
      api.stepComplete(courseId, stepIndex),
    onSuccess: (_, { courseId }) => {
      qc.invalidateQueries({ queryKey: KEYS.progress(courseId) });
      qc.invalidateQueries({ queryKey: KEYS.courses });
    },
  });
}
