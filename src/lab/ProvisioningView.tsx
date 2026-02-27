import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { LabProvisioning, LabFailed } from "@/types/lab";

// Shown while the lab is scaffolding, running setup scripts, or starting services.
// Streams log output in real time. Scrolls to bottom automatically.

type ProvisioningViewProps = {
  readonly state: LabProvisioning | LabFailed;
  readonly onRetry?: (() => void) | undefined;
};

export function ProvisioningView({ state, onRetry }: ProvisioningViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [state]);

  const failed = state.kind === "failed";

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        {failed ? (
          <div className="size-8 rounded-full bg-destructive/20 flex items-center justify-center">
            <span className="text-destructive text-lg font-bold">!</span>
          </div>
        ) : (
          <Loader2 className="size-8 animate-spin text-primary" />
        )}
        <h2 className="text-lg font-medium">
          {failed ? "Provisioning Failed" : "Setting up your lab..."}
        </h2>
        <p className="text-sm text-muted-foreground">
          {failed ? state.error : state.lab.title}
        </p>
      </div>

      {state.kind === "provisioning" && state.log.length > 0 ? (
        <div
          ref={scrollRef}
          className="ide-scrollbar w-full max-w-xl rounded-md border border-border bg-card p-3 max-h-64 overflow-y-auto"
        >
          <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
            {state.log.join("\n")}
          </pre>
        </div>
      ) : null}

      {failed && onRetry !== undefined ? (
        <button
          onClick={onRetry}
          className="press focus-ring rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
