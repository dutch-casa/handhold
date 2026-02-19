import { useEffect, useRef } from "react";
import {
  CircleCheck,
  CircleAlert,
  CircleMinus,
  CircleX,
  Loader2,
  Play,
  Square,
  RotateCw,
  Terminal,
  Container,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { ContainerState, ContainerView, RuntimeState } from "@/types/lab";

// Table-driven state → visual config mapping
type StateConfig = {
  readonly icon: LucideIcon;
  readonly color: string;
  readonly spin: boolean;
};

function stateConfig(state: ContainerState): StateConfig {
  switch (state.kind) {
    case "running":
      switch (state.health) {
        case "healthy":
          return { icon: CircleCheck, color: "text-green-400", spin: false };
        case "starting":
          return { icon: Loader2, color: "text-yellow-400", spin: true };
        case "unhealthy":
          return { icon: CircleAlert, color: "text-destructive", spin: false };
        case "none":
          return { icon: CircleCheck, color: "text-green-400", spin: false };
      }
    case "stopped":
      return { icon: CircleMinus, color: "text-muted-foreground", spin: false };
    case "error":
      return { icon: CircleX, color: "text-destructive", spin: false };
  }
}

// --- Compound components ---

export type ServicePanelProps = {
  readonly runtime: RuntimeState;
  readonly containers: readonly ContainerView[];
  readonly selected: string | undefined;
  readonly logs: readonly string[];
  readonly serviceCount: number;
  readonly onSelect: (name: string | undefined) => void;
  readonly onAction: (name: string, action: "start" | "stop" | "restart") => Promise<void>;
  readonly onExec: (name: string) => Promise<void>;
};

function RuntimeBanner({ runtime }: { readonly runtime: RuntimeState }) {
  if (runtime.kind !== "missing") return null;
  return (
    <div className="p-3">
      <Alert>
        <AlertTriangle className="size-4 text-yellow-400" />
        <AlertTitle>No container runtime</AlertTitle>
        <AlertDescription>
          Install Podman to run lab services:
          <code className="ml-1 rounded bg-muted px-1 py-0.5 text-xs">brew install podman</code>
        </AlertDescription>
      </Alert>
    </div>
  );
}

function ServiceRow({
  container,
  active,
  onSelect,
  onAction,
}: {
  readonly container: ContainerView;
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly onAction: (action: "start" | "stop" | "restart") => void;
}) {
  const config = stateConfig(container.state);
  const Icon = config.icon;
  const isRunning = container.state.kind === "running";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
        active ? "bg-accent" : "hover:bg-muted/50"
      }`}
    >
      <Icon
        className={`size-3.5 shrink-0 ${config.color} ${config.spin ? "animate-spin" : ""}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate font-medium">{container.name}</span>
      <span className="hidden truncate text-muted-foreground sm:inline max-w-[120px]">
        {container.image}
      </span>
      {container.ports ? (
        <span className="shrink-0 font-variant-numeric tabular-nums text-muted-foreground">
          {container.ports}
        </span>
      ) : null}

      {/* Action buttons — 44px tap target each */}
      <span className="flex shrink-0 items-center gap-0.5">
        {isRunning ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAction("stop"); }}
            className="focus-ring press flex size-7 items-center justify-center rounded hover:bg-muted"
            aria-label={`Stop ${container.name}`}
          >
            <Square className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAction("start"); }}
            className="focus-ring press flex size-7 items-center justify-center rounded hover:bg-muted"
            aria-label={`Start ${container.name}`}
          >
            <Play className="size-3" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAction("restart"); }}
          className="focus-ring press flex size-7 items-center justify-center rounded hover:bg-muted"
          aria-label={`Restart ${container.name}`}
        >
          <RotateCw className="size-3" />
        </button>
      </span>
    </button>
  );
}

function LogViewer({
  name,
  logs,
  onExec,
}: {
  readonly name: string;
  readonly logs: readonly string[];
  readonly onExec: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [logs]);

  return (
    <div className="flex flex-col border-t border-border">
      <div className="ide-section-header border-b border-border justify-between">
        <span className="truncate">Logs: {name}</span>
        <button
          type="button"
          onClick={onExec}
          className="focus-ring press flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors hover:bg-muted"
          aria-label={`Exec into ${name}`}
        >
          <Terminal className="size-3" />
          Exec
        </button>
      </div>
      <div ref={scrollRef} className="max-h-60 flex-1 overflow-y-auto ide-scrollbar p-3">
        <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
          {logs.length > 0 ? logs.join("\n") : "No logs yet."}
        </pre>
      </div>
    </div>
  );
}

export function ServicePanel({
  runtime,
  containers,
  selected,
  logs,
  serviceCount,
  onSelect,
  onAction,
  onExec,
}: ServicePanelProps) {
  if (serviceCount === 0) {
    return (
      <div className="ide-empty-state h-full">
        <Container className="size-6 opacity-50" />
        <span className="text-xs">No services configured</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <RuntimeBanner runtime={runtime} />

      <div className="ide-section-header border-b border-border">
        <Container className="size-3.5" />
        <span>Services</span>
      </div>

      <div className="flex-1 overflow-y-auto ide-scrollbar">
        {containers.map((c) => (
          <ServiceRow
            key={c.name}
            container={c}
            active={c.name === selected}
            onSelect={() => onSelect(c.name === selected ? undefined : c.name)}
            onAction={(action) => { onAction(c.name, action); }}
          />
        ))}
      </div>

      {selected !== undefined ? (
        <LogViewer
          name={selected}
          logs={logs}
          onExec={() => { onExec(selected); }}
        />
      ) : null}
    </div>
  );
}
