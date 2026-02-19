import { useState, useEffect, useRef } from "react";
import { Play, CheckCircle2, XCircle, AlertTriangle, Loader2, ChevronDown } from "lucide-react";
import type { TestRunState, TestAssertion } from "@/types/lab";

type TestRunnerPanelProps = {
  readonly testRun: TestRunState;
  readonly onRun: () => void;
};

const STATUS_CONFIG = {
  idle: { icon: Play, label: "Run Tests", color: "text-muted-foreground" },
  running: { icon: Loader2, label: "Running...", color: "text-primary" },
  passed: { icon: CheckCircle2, label: "Passed", color: "text-green-400" },
  failed: { icon: XCircle, label: "Failed", color: "text-destructive" },
  error: { icon: AlertTriangle, label: "Error", color: "text-yellow-400" },
} as const;

function AssertionList({ assertions }: { readonly assertions: readonly TestAssertion[] }) {
  const passed = assertions.filter((a) => a.passed).length;
  return (
    <div className="flex flex-col gap-1">
      {assertions.map((a) => (
        <div key={a.description} className="flex items-center gap-2 text-xs">
          {a.passed ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-green-400" />
          ) : (
            <XCircle className="size-3.5 shrink-0 text-destructive" />
          )}
          <span className={a.passed ? "text-muted-foreground" : "text-foreground"}>
            {a.description}
          </span>
        </div>
      ))}
      <div className="mt-1 text-xs text-muted-foreground">
        {passed}/{assertions.length} passed
      </div>
    </div>
  );
}

export function TestRunnerPanel({ testRun, onRun }: TestRunnerPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [testRun]);

  const config = STATUS_CONFIG[testRun.kind];
  const Icon = config.icon;
  const isRunning = testRun.kind === "running";
  const hasOutput = testRun.kind === "running" || testRun.kind === "passed" || testRun.kind === "failed";
  const duration = (testRun.kind === "passed" || testRun.kind === "failed") ? testRun.durationMs : undefined;
  const assertions = (testRun.kind === "passed" || testRun.kind === "failed") ? testRun.assertions : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="ide-section-header border-b border-border justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`size-3.5 ${config.color} ${isRunning ? "animate-spin" : ""}`} />
          <span>{config.label}</span>
          {duration !== undefined ? (
            <span className="text-muted-foreground font-normal">({(duration / 1000).toFixed(1)}s)</span>
          ) : null}
        </div>
        <button
          onClick={onRun}
          disabled={isRunning}
          className="focus-ring press flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
          aria-label="Run tests"
        >
          <Play className="size-3" />
          Run
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto ide-scrollbar p-3">
        {testRun.kind === "idle" ? (
          <div className="ide-empty-state">
            <Play className="size-6 opacity-50" />
            <span className="text-xs">Click Run to execute tests</span>
          </div>
        ) : testRun.kind === "error" ? (
          <div className="ide-empty-state">
            <AlertTriangle className="size-6 text-yellow-400 opacity-70" />
            <span className="text-xs text-yellow-400">{testRun.message}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {assertions !== undefined && assertions.length > 0 ? (
              <AssertionList assertions={assertions} />
            ) : null}

            {hasOutput ? (
              <details open={rawOpen} onToggle={(e) => setRawOpen(e.currentTarget.open)}>
                <summary className="flex cursor-pointer select-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronDown className={`size-3 transition-transform ${rawOpen ? "" : "-rotate-90"}`} />
                  Raw output
                </summary>
                <pre className="mt-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
                  {testRun.output}
                </pre>
              </details>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
