/** Mirrors Rust CourseRecord — the shape returned from all course queries. */
export type CourseRecord = {
  readonly id: string;
  readonly sourceUrl: string;
  readonly localPath: string;
  readonly title: string;
  readonly description: string;
  readonly stepCount: number;
  readonly addedAt: number;
  readonly completedSteps: number;
  readonly tags: readonly string[];
};

/** Discriminated union — every import outcome is an explicit variant. */
export type ImportResult =
  | { readonly kind: "ok"; readonly course: CourseRecord }
  | { readonly kind: "invalidUrl" }
  | { readonly kind: "notFound" }
  | { readonly kind: "noManifest" }
  | { readonly kind: "badManifest"; readonly reason: string }
  | { readonly kind: "alreadyExists" }
  | { readonly kind: "downloadFailed"; readonly reason: string };

/** App-level navigation state persisted to SQLite. */
export type Route =
  | { readonly kind: "browser" }
  | { readonly kind: "course"; readonly courseId: string; readonly stepIndex: number };

/** A step entry from handhold.yaml — the manifest on disk. */
export type ManifestStep = {
  readonly kind: "lesson" | "lab";
  readonly title: string;
  readonly path: string;
};

/** Tracks which slide a user is on within a lesson. */
export type SlidePosition = {
  readonly slideIndex: number;
  readonly slideCount: number | null;
};

/** A course dependency entry — install command already resolved for the current OS. */
export type CourseDependency = {
  readonly name: string;
  /** Shell command to probe whether the tool exists (e.g. "node --version"). */
  readonly check: string;
  /** Install command for this platform, or null if not provided. */
  readonly install: string | null;
};

/** Parsed handhold.yaml — drives course loading from disk. */
export type CourseManifest = {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly steps: readonly ManifestStep[];
  readonly dependencies: readonly CourseDependency[];
};

/** Raw lab.yaml config — every field defaults to empty. TS resolves presets. */
export type RawLabConfig = {
  readonly workspace: string;
  readonly test: string;
  readonly open: readonly string[];
  readonly services: readonly unknown[];
  readonly setup: readonly string[];
};

/** Everything Rust reads from a lab directory — instructions, scaffold info, config. */
export type LabData = {
  readonly instructions: string;
  readonly hasScaffold: boolean;
  readonly scaffoldPath: string;
  readonly hasSolution: boolean;
  readonly solutionPath: string;
  readonly labDirPath: string;
  readonly workspacePath: string;
  readonly config: RawLabConfig;
};
