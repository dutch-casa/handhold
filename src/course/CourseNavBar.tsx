import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ManifestStep } from "@/types/browser";

type NavControls = {
  readonly progress: { readonly current: number; readonly total: number };
  readonly canNext: boolean;
  readonly canPrev: boolean;
  readonly next: () => void;
  readonly prev: () => void;
  readonly stepTitle: string;
  readonly steps: readonly ManifestStep[];
  readonly goTo: (index: number) => void;
  readonly completedSteps: ReadonlySet<number>;
};

type CourseNavBarProps = {
  readonly nav: NavControls;
  readonly onBack?: (() => void) | undefined;
};

export function CourseNavBar({ nav, onBack }: CourseNavBarProps) {
  const [open, setOpen] = useState(false);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        currentRef.current?.scrollIntoView({ block: "center" });
      });
    }
  }, [open]);

  const handleSelect = useCallback(
    (index: number) => {
      nav.goTo(index);
      setOpen(false);
    },
    [nav],
  );

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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className="focus-ring tabular-nums rounded px-1.5 py-0.5 hover:bg-muted"
            aria-label="Jump to step"
          >
            {nav.progress.current} / {nav.progress.total}
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={4}
            className="w-80 p-0"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="font-medium">Steps</span>
              <span className="text-muted-foreground">{nav.progress.total} total</span>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {nav.steps.map((step, i) => {
                const isCurrent = i === nav.progress.current - 1;
                const isCompleted = nav.completedSteps.has(i);
                return (
                  <button
                    key={step.path}
                    ref={isCurrent ? currentRef : undefined}
                    onClick={() => handleSelect(i)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted ${isCurrent ? "bg-accent/50 text-accent-foreground" : ""}`}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                      {step.kind === "lesson"
                        ? <BookOpen className="size-3" />
                        : <FlaskConical className="size-3" />}
                    </span>
                    <span className="tabular-nums text-muted-foreground w-5 shrink-0 text-right">
                      {i + 1}.
                    </span>
                    <span className="truncate">{step.title}</span>
                    {isCompleted && (
                      <Check className="ml-auto size-3 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
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
