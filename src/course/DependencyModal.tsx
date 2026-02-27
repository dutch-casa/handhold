import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon, LoaderIcon, DownloadIcon } from "lucide-react";
import { useDepChecks } from "@/browser/use-courses";
import { exec } from "@/lab/tauri/runner";
import type { CourseDependency } from "@/types/browser";

// Illegal states (e.g. running with an exitCode) are not expressible.
type InstallState =
  | { readonly kind: "idle" }
  | { readonly kind: "running"; readonly output: readonly string[] }
  | { readonly kind: "done"; readonly exitCode: number; readonly output: readonly string[] };

type Props = {
  readonly open: boolean;
  readonly deps: readonly CourseDependency[];
  /** Absolute path used as cwd for install commands. */
  readonly homeDir: string;
  readonly onBack: () => void;
  readonly onContinue: () => void;
};

export function DependencyModal({ open, deps, homeDir, onBack, onContinue }: Props) {
  const checkResults = useDepChecks(deps);
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>({});

  // Stable reference — only depends on homeDir which is a primitive string.
  const handleInstall = useCallback(
    async (dep: CourseDependency) => {
      if (!dep.install) return;
      const key = dep.check;

      setInstallStates((prev) => ({ ...prev, [key]: { kind: "running", output: [] } }));

      const exitCode = await exec(dep.install, homeDir, (line) => {
        setInstallStates((prev) => {
          const cur = prev[key];
          if (cur?.kind !== "running") return prev;
          return { ...prev, [key]: { ...cur, output: [...cur.output, line] } };
        });
      });

      setInstallStates((prev) => {
        const cur = prev[key];
        if (cur?.kind !== "running") return prev;
        return { ...prev, [key]: { kind: "done", exitCode, output: cur.output } };
      });
    },
    [homeDir],
  );

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Course Requirements</DialogTitle>
          <DialogDescription>
            This course requires the following tools. Install any that are
            missing, then continue.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-3">
          {deps.map((dep, i) => {
            const result = checkResults[i];
            const checking = result?.isLoading ?? true;
            const installed = result?.data === true;
            const state: InstallState = installStates[dep.check] ?? { kind: "idle" };
            const succeededAfterInstall = state.kind === "done" && state.exitCode === 0;
            const isAvailable = installed || succeededAfterInstall;

            return (
              <li key={dep.check} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* Fixed size-5 container prevents layout shift when icon swaps. */}
                    <span className="flex size-5 items-center justify-center">
                      {checking ? (
                        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
                      ) : isAvailable ? (
                        <CheckIcon className="size-4 text-green-500" />
                      ) : (
                        <XIcon className="size-4 text-destructive" />
                      )}
                    </span>
                    <span className="text-sm font-medium">{dep.name}</span>
                  </div>

                  {!checking && !isAvailable && dep.install !== null && state.kind === "idle" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { void handleInstall(dep); }}
                    >
                      <DownloadIcon className="size-3.5" />
                      Install
                    </Button>
                  )}
                  {state.kind === "running" && (
                    <span className="text-xs text-muted-foreground">Installing…</span>
                  )}
                </div>

                {(state.kind === "running" || state.kind === "done") &&
                  state.output.length > 0 && (
                    <pre className="max-h-32 overflow-y-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
                      {state.output.join("")}
                    </pre>
                  )}
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={onBack}>Go Back</Button>
          <Button onClick={onContinue}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
