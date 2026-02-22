// Builds a concise text summary of the editor state for injection into agent messages.
// The agent needs to know what the user is looking at to make relevant edits.

export type ActiveStepContent = {
  readonly narration: readonly { readonly text: string }[];
  readonly blockNames: readonly string[];
  readonly regionNames: readonly string[];
  readonly sceneCount: number;
  readonly diagnostics: readonly {
    readonly severity: string;
    readonly message: string;
  }[];
};

export type EditorSnapshot = {
  readonly courseTitle: string;
  readonly steps: readonly {
    readonly id: string;
    readonly title: string;
    readonly kind: "lesson" | "lab";
  }[];
  readonly activeStepId: string | null;
  readonly activeStepContent?: ActiveStepContent | undefined;
};

// Produce a compact text block the agent can parse at a glance.
// No JSON -- structured prose is cheaper in tokens and easier to reason about.
export function buildAgentContext(snapshot: EditorSnapshot): string {
  const lines: string[] = [];

  lines.push(`# Course: "${snapshot.courseTitle}"`);
  lines.push("");
  lines.push("## Structure");

  for (let i = 0; i < snapshot.steps.length; i++) {
    const step = snapshot.steps[i]!;
    const marker = step.id === snapshot.activeStepId ? " \u2190 active" : "";
    lines.push(`${i + 1}. [${step.kind}] ${step.title}${marker}`);
  }

  if (snapshot.activeStepId !== null && snapshot.activeStepContent !== undefined) {
    const activeStep = snapshot.steps.find(
      (s) => s.id === snapshot.activeStepId,
    );
    const title = activeStep !== undefined ? activeStep.title : snapshot.activeStepId;
    const c = snapshot.activeStepContent;

    lines.push("");
    lines.push(`## Active Step: "${title}"`);
    lines.push(`Narration: ${c.narration.length} paragraph${c.narration.length === 1 ? "" : "s"}`);

    if (c.blockNames.length > 0) {
      lines.push(`Blocks: ${c.blockNames.join(", ")}`);
    } else {
      lines.push("Blocks: none");
    }

    if (c.regionNames.length > 0) {
      lines.push(`Regions: ${c.regionNames.join(", ")}`);
    } else {
      lines.push("Regions: none");
    }

    lines.push(`Scenes: ${c.sceneCount}`);

    if (c.diagnostics.length > 0) {
      lines.push(`Diagnostics:`);
      for (const d of c.diagnostics) {
        lines.push(`  - [${d.severity}] ${d.message}`);
      }
    } else {
      lines.push("Diagnostics: none");
    }
  }

  return lines.join("\n");
}
