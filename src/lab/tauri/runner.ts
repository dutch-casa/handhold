import { invoke, Channel } from "@tauri-apps/api/core";

// Non-interactive command execution — setup scripts, teardown, test runner

// Serde adjacently-tagged enum: { event: "stdout", data: { data: "line\n" } }
type RunnerEvent =
  | { readonly event: "stdout"; readonly data: { readonly data: string } }
  | { readonly event: "stderr"; readonly data: { readonly data: string } };

export type ExitCode = number;

export async function exec(
  command: string,
  cwd: string,
  onOutput?: ((line: string) => void) | undefined,
): Promise<ExitCode> {
  const onEvent = new Channel<RunnerEvent>();
  if (onOutput !== undefined) {
    onEvent.onmessage = (event) => onOutput(event.data.data);
  }

  const result = await invoke<{ exitCode: number }>("run_command", {
    command,
    cwd,
    env: [],
    onOutput: onEvent,
  });

  return result.exitCode;
}
