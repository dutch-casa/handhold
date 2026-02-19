import { invoke, Channel } from "@tauri-apps/api/core";
import type { CourseRecord, CourseManifest, ImportResult, LabData, Route, SlidePosition } from "@/types/browser";

type WatchEvent = { readonly event: "changed" };
type Disposable = { dispose: () => void };

export const courseImport = (githubUrl: string) =>
  invoke<ImportResult>("course_import", { githubUrl });

export const courseList = () =>
  invoke<readonly CourseRecord[]>("course_list");

export const courseSearch = (query: string) =>
  invoke<readonly CourseRecord[]>("course_search", { query });

export const courseTags = () =>
  invoke<readonly string[]>("course_tags");

export const courseByTag = (tag: string) =>
  invoke<readonly CourseRecord[]>("course_by_tag", { tag });

export const courseDelete = (id: string) =>
  invoke<void>("course_delete", { id });

export const stepComplete = (courseId: string, stepIndex: number) =>
  invoke<void>("step_complete", { courseId, stepIndex });

export const stepProgress = (courseId: string) =>
  invoke<readonly number[]>("step_progress", { courseId });

export const routeSave = (route: Route) =>
  invoke<void>("route_save", { route });

export const routeLoad = () =>
  invoke<Route>("route_load");

export const courseGet = (id: string) =>
  invoke<CourseRecord>("course_get", { id });

export const courseManifest = (id: string) =>
  invoke<CourseManifest>("course_manifest", { id });

export const courseReadStep = (id: string, stepPath: string) =>
  invoke<string>("course_read_step", { id, stepPath });

export const courseReadLab = (id: string, stepPath: string) =>
  invoke<LabData>("course_read_lab", { id, stepPath });

export type SyncResult = { readonly added: number; readonly removed: number };

export const coursesDirPath = () =>
  invoke<string>("courses_dir_path");

export const courseSync = () =>
  invoke<SyncResult>("course_sync");

export async function watchDir(
  path: string,
  onChange: () => void,
): Promise<Disposable> {
  const onEvent = new Channel<WatchEvent>();
  onEvent.onmessage = () => onChange();

  const watcherId = await invoke<number>("watch_dir", {
    path,
    onEvent,
  });

  return {
    dispose: () => {
      invoke("unwatch_dir", { watcherId }).catch(() => {
        // Best-effort cleanup
      });
    },
  };
}

export const slidePositionSave = (
  courseId: string,
  stepIndex: number,
  slideIndex: number,
  slideCount: number | null,
) => invoke<void>("slide_position_save", { courseId, stepIndex, slideIndex, slideCount });

export const slidePositionLoad = (courseId: string, stepIndex: number) =>
  invoke<SlidePosition | null>("slide_position_load", { courseId, stepIndex });

export const slideComplete = (courseId: string, stepIndex: number, slideId: string) =>
  invoke<void>("slide_complete", { courseId, stepIndex, slideId });

export const slideCompletions = (courseId: string, stepIndex: number) =>
  invoke<string[]>("slide_completions", { courseId, stepIndex });
