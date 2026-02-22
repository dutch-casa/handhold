// Sidebar — activity bar (48px icon strip) + content area.
// Active section stored in layout store. Clicking an icon switches sections.
// Content sections: CourseTree, Blocks (placeholder), Regions (placeholder), Diagnostics (placeholder).

import {
  useLayoutStore,
  type SidebarSection,
} from "@/editor/viewmodel/layout-store";
import { CourseTree } from "@/editor/view/sidebar/CourseTree";

// ── Activity bar icon definitions ────────────────────────────────

const SECTIONS = [
  {
    id: "course" as const,
    label: "Course Tree",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3v14" />
        <path d="M6 3h8l-3 3h-5" />
        <path d="M6 10h5l3-3" />
      </svg>
    ),
  },
  {
    id: "blocks" as const,
    label: "Blocks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="11" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="11" width="6" height="6" rx="1" />
        <rect x="11" y="11" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    id: "regions" as const,
    label: "Regions",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="12" rx="1.5" />
        <path d="M3 8h14" />
        <path d="M8 8v8" />
      </svg>
    ),
  },
  {
    id: "diagnostics" as const,
    label: "Diagnostics",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 7v3.5" />
        <circle cx="10" cy="13" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
] satisfies ReadonlyArray<{
  readonly id: SidebarSection;
  readonly label: string;
  readonly icon: React.ReactNode;
}>;

// ── Activity bar ─────────────────────────────────────────────────

function ActivityBar() {
  const section = useLayoutStore((s) => s.sidebarSection);
  const setSection = useLayoutStore((s) => s.setSidebarSection);

  return (
    <div className="flex h-full w-[var(--activity-bar-w)] shrink-0 flex-col items-center gap-sp-1 border-r border-border bg-background pt-sp-2">
      {SECTIONS.map((s) => {
        const active = section === s.id;
        return (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`
              relative flex h-11 w-11 items-center justify-center rounded-md
              transition-colors duration-fast focus-ring
              ${active
                ? "text-foreground bg-sidebar-accent"
                : "text-muted-foreground hover:text-foreground"
              }
            `}
            aria-label={s.label}
            aria-pressed={active}
          >
            {s.icon}
            {active && (
              <div className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Placeholder sections ─────────────────────────────────────────

function BlocksPlaceholder() {
  return (
    <div className="ide-empty-state h-full">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="opacity-30">
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </svg>
      <span className="text-ide-xs text-muted-foreground">No blocks yet</span>
    </div>
  );
}

function RegionsPlaceholder() {
  return (
    <div className="ide-empty-state h-full">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="opacity-30">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M10 10v10" />
      </svg>
      <span className="text-ide-xs text-muted-foreground">No regions defined</span>
    </div>
  );
}

function DiagnosticsPlaceholder() {
  return (
    <div className="ide-empty-state h-full">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="opacity-30">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <circle cx="12" cy="16" r="0.5" fill="currentColor" />
      </svg>
      <span className="text-ide-xs text-muted-foreground">No issues</span>
    </div>
  );
}

// ── Section content router ───────────────────────────────────────

function SectionContent({ section }: { readonly section: SidebarSection }) {
  switch (section) {
    case "course":
      return <CourseTree />;
    case "blocks":
      return <BlocksPlaceholder />;
    case "regions":
      return <RegionsPlaceholder />;
    case "diagnostics":
      return <DiagnosticsPlaceholder />;
  }
}

// ── Sidebar shell ────────────────────────────────────────────────

export function Sidebar() {
  const section = useLayoutStore((s) => s.sidebarSection);

  return (
    <div className="flex h-full">
      <ActivityBar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <SectionContent section={section} />
      </div>
    </div>
  );
}
