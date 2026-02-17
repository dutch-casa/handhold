import { useCallback } from "react";
import { exec } from "@/lab/tauri/runner";
import { parseTap } from "@/lab/tap-parser";
import type { TestRunState } from "@/types/lab";

// Deep module: runs the lab's test command and streams output.
// Caller provides the dispatch — this hook owns execution logic.

type TestRunnerCallbacks = {
  readonly setTestRun: (state: TestRunState) => void;
};

export type TestRunner = {
  readonly run: () => Promise<void>;
};

export function useTestRunner(
  testCommand: string,
  workspacePath: string,
  callbacks: TestRunnerCallbacks,
): TestRunner {
  const { setTestRun } = callbacks;

  const run = useCallback(async () => {
    let output = "";
    setTestRun({ kind: "running", output: "" });
    const start = performance.now();

    try {
      await exec(testCommand, workspacePath, (line) => {
        output += line;
        setTestRun({ kind: "running", output });
      });

      const durationMs = Math.round(performance.now() - start);
      const assertions = parseTap(output);
      const allPassed = assertions.length > 0 && assertions.every((a) => a.passed);

      if (allPassed) {
        setTestRun({ kind: "passed", assertions, output, durationMs });
      } else {
        setTestRun({ kind: "failed", assertions, output, durationMs });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestRun({ kind: "error", message });
    }
  }, [testCommand, workspacePath, setTestRun]);

  return { run };
}
