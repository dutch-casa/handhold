import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

/** Only the fields CourseNavBar actually reads — no coupling to full CourseNav. */
type NavControls = {
  readonly progress: { readonly current: number; readonly total: number };
  readonly canNext: boolean;
  readonly canPrev: boolean;
  readonly next: () => void;
  readonly prev: () => void;
  readonly stepTitle: string;
};

type CourseNavBarProps = {
  readonly nav: NavControls;
  readonly onBack?: (() => void) | undefined;
};

export function CourseNavBar({ nav, onBack }: CourseNavBarProps) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-[#0e0e0e] px-3 text-xs">
      <div className="flex items-center gap-1.5">
        {onBack !== undefined && (
          <button
            onClick={onBack}
            className="focus-ring mr-1 flex items-center rounded p-0.5 hover:bg-muted"
            aria-label="Back to courses"
          >
            <ArrowLeft className="size-3.5" />
          </button>
        )}
        <button
          onClick={nav.prev}
          disabled={!nav.canPrev}
          className="focus-ring flex items-center rounded p-0.5 hover:bg-muted disabled:opacity-30"
          aria-label="Previous step"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="tabular-nums">
          {nav.progress.current} / {nav.progress.total}
        </span>
        <button
          onClick={nav.next}
          disabled={!nav.canNext}
          className="focus-ring flex items-center rounded p-0.5 hover:bg-muted disabled:opacity-30"
          aria-label="Next step"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <span className="text-muted-foreground truncate ml-2">{nav.stepTitle}</span>
    </div>
  );
}
