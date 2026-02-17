# Course Browser Design

Default view when the app launches. Browse downloaded courses, track progress, import from GitHub, filter by tag, search.

## Data Model (SQLite)

Database at `~/.handhold/handhold.db`. STRICT tables, WITHOUT ROWID on join/lookup tables, WAL mode, foreign keys enforced.

Row existence in `step_completion` = completed. No row = not started. Representation deletes the "incomplete row" case.

FTS5 external content table for search — trigger-synced, no text duplication.

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE course (
  id          TEXT PRIMARY KEY,
  github_url  TEXT NOT NULL UNIQUE,
  local_path  TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  step_count  INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  CHECK (length(id) > 0),
  CHECK (length(github_url) > 0),
  CHECK (step_count > 0)
) STRICT;

CREATE TABLE tag (
  course_id  TEXT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  PRIMARY KEY (course_id, name),
  CHECK (length(name) > 0)
) STRICT, WITHOUT ROWID;

CREATE TABLE step_completion (
  course_id    TEXT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  step_index   INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (course_id, step_index),
  CHECK (step_index >= 0)
) STRICT, WITHOUT ROWID;

CREATE VIRTUAL TABLE course_search USING fts5(
  title, description,
  content='course',
  content_rowid='rowid'
);

CREATE TRIGGER course_ins AFTER INSERT ON course BEGIN
  INSERT INTO course_search(rowid, title, description)
  VALUES (new.rowid, new.title, new.description);
END;

CREATE TRIGGER course_del AFTER DELETE ON course BEGIN
  INSERT INTO course_search(course_search, rowid, title, description)
  VALUES ('delete', old.rowid, old.title, old.description);
END;

CREATE TRIGGER course_upd AFTER UPDATE ON course BEGIN
  INSERT INTO course_search(course_search, rowid, title, description)
  VALUES ('delete', old.rowid, old.title, old.description);
  INSERT INTO course_search(rowid, title, description)
  VALUES (new.rowid, new.title, new.description);
END;
```

## Navigation

Discriminated union at App level, persisted to SQLite:

```ts
type Route =
  | { readonly kind: "browser" }
  | { readonly kind: "course"; readonly courseId: string; readonly stepIndex: number };
```

On launch: load last route from SQLite, validate courseId still exists, fall back to `browser` if invalid.

## Course Manifest

`handhold.yaml` at repo root:

```yaml
title: "Dijkstra's Algorithm"
description: "Shortest path in weighted graphs"
tags:
  - algorithms
  - graphs
steps:
  - kind: lesson
    title: "The Problem"
    path: steps/01-the-problem.md
  - kind: lesson
    title: "Priority Queues"
    path: steps/02-priority-queues.md
  - kind: lab
    title: "Implement Dijkstra"
    path: labs/01-implement/
```

TypeScript mirror:

```ts
type CourseManifestStep =
  | { readonly kind: "lesson"; readonly title: string; readonly path: string }
  | { readonly kind: "lab"; readonly title: string; readonly path: string };

type CourseManifest = {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly steps: readonly CourseManifestStep[];
};
```

Validation: `(unknown) => CourseManifest | ManifestError`. Rejects at boundary.

## GitHub Import

Consumer surface:

```ts
type ImportResult =
  | { readonly kind: "ok"; readonly course: CourseRecord }
  | { readonly kind: "invalid_url" }
  | { readonly kind: "not_found" }
  | { readonly kind: "no_manifest" }
  | { readonly kind: "bad_manifest"; readonly reason: string }
  | { readonly kind: "already_exists" }
  | { readonly kind: "clone_failed"; readonly reason: string };

function importCourse(githubUrl: string): Promise<ImportResult>
```

Steps behind the surface:

1. Parse URL — extract owner/repo (optional branch)
2. Check duplicate in SQLite
3. Validate manifest remotely — fetch `handhold.yaml` via raw.githubusercontent.com before cloning
4. Clone — `git clone --depth 1` to `~/.handhold/courses/<owner>--<repo>/` (Rust side)
5. Insert course + tags in one SQLite transaction
6. Return `{ kind: "ok", course }`

## UI Components

```
App
├── Browser                    (route.kind === "browser")
│   ├── Browser.Header         (search + tag filter + add button)
│   ├── Browser.Grid           (course cards)
│   │   └── Browser.CourseCard (title, tags, progress)
│   └── Browser.ImportDialog   (github url input + result feedback)
└── CourseShell                (route.kind === "course")
    ├── CourseNavBar            (+ back-to-browser button)
    ├── Presentation           (step.kind === "lesson")
    └── Lab                    (step.kind === "lab")
```

Compound component pattern. React Query for all data fetching. SQLite calls through Tauri invoke.

## Tauri Commands (Rust)

```
course_import(github_url: String) -> ImportResult
course_list() -> Vec<CourseRecord>
course_search(query: String) -> Vec<CourseRecord>
course_tags() -> Vec<String>
course_by_tag(tag: String) -> Vec<CourseRecord>
course_delete(id: String) -> ()
step_complete(course_id: String, step_index: u32) -> ()
step_progress(course_id: String) -> Vec<u32>
route_save(route: Route) -> ()
route_load() -> Route
db_init() -> ()
```

## Lesson Completion

A lesson is complete when the user reaches the last step. `usePresentationStore` fires `step_complete` mutation on last-step advance. Course list query auto-invalidates.

## Migration

1. Add `handhold.yaml` to existing `courses/dijkstra/`
2. On first launch, `db_init()` creates schema and seeds dijkstra as built-in
3. `App.tsx` switches from hard-coded glob to route-based discriminated union
4. `useCourse` loads steps from manifest + local file paths instead of Vite globs
