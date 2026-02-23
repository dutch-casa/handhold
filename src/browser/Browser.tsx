import { createContext, use, useEffect, useState, useDeferredValue } from "react";
import { useCourses, useCourseTags, useCourseSearch, useCoursesByTag } from "@/browser/use-courses";
import type { CourseRecord } from "@/types/browser";
import { CourseCard } from "@/browser/CourseCard";
import { ImportDialog } from "@/browser/ImportDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import LogoSvg from "@/public/Logo.svg?url";

type BrowserContext = {
  readonly onOpen: (course: CourseRecord) => void;
};

const Ctx = createContext<BrowserContext | null>(null);

function useBrowser(): BrowserContext {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useBrowser must be used within Browser");
  return ctx;
}

export { useBrowser };

type BrowserProps = {
  readonly onOpen: (course: CourseRecord) => void;
  readonly initialImportUrl?: string | undefined;
  readonly onImportHandled?: (() => void) | undefined;
};

const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

export function Browser({ onOpen, initialImportUrl, onImportHandled }: BrowserProps) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (initialImportUrl && initialImportUrl.length > 0) {
      setImportOpen(true);
    }
  }, [initialImportUrl]);

  const deferredSearch = useDeferredValue(search);

  const allCourses = useCourses();
  const tags = useCourseTags();
  const searchResults = useCourseSearch(deferredSearch);
  const tagResults = useCoursesByTag(activeTag);

  // Determine which dataset to display based on active filters
  const courses: readonly CourseRecord[] = (() => {
    if (deferredSearch.length > 0) return searchResults.data ?? [];
    if (activeTag.length > 0) return tagResults.data ?? [];
    return allCourses.data ?? [];
  })();

  const isLoading = allCourses.isLoading;

  return (
    <Ctx value={{ onOpen }}>
      <div className="flex h-screen flex-col bg-background">
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
          <img src={LogoSvg} alt="Handhold" className="size-8 shrink-0" />
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveTag("");
              }}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setImportOpen(true)}>
            <Plus data-icon="inline-start" />
            Add Course
          </Button>
        </header>

        {(tags.data?.length ?? 0) > 0 && (
          <div className="flex shrink-0 gap-2 border-b border-border px-6 py-3 overflow-x-auto">
            <Badge
              variant={activeTag === "" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveTag("")}
            >
              All
            </Badge>
            {tags.data?.map((tag) => (
              <Badge
                key={tag}
                variant={activeTag === tag ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  setActiveTag(tag);
                  setSearch("");
                }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SKELETON_KEYS.map((key) => (
                <div
                  key={key}
                  className="h-48 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              hasSearch={deferredSearch.length > 0 || activeTag.length > 0}
              onImport={() => setImportOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} onOpen={onOpen} />
              ))}
            </div>
          )}
        </main>

        <footer className="shrink-0 border-t border-border px-6 py-3 text-center text-xs text-muted-foreground">
          © 2026 Dutch Casadaban
        </footer>

        <ImportDialog
          open={importOpen}
          onOpenChange={(open) => {
            setImportOpen(open);
            if (!open && onImportHandled) onImportHandled();
          }}
          initialUrl={initialImportUrl}
        />
      </div>
    </Ctx>
  );
}

function EmptyState({
  hasSearch,
  onImport,
}: {
  readonly hasSearch: boolean;
  readonly onImport: () => void;
}) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
        <Search className="size-10 opacity-30" />
        <p className="text-sm">No courses match your search</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-muted-foreground">
      <p className="text-sm">No courses yet</p>
      <Button variant="outline" onClick={onImport}>
        <Plus data-icon="inline-start" />
        Add your first course
      </Button>
    </div>
  );
}
