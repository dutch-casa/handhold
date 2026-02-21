import { resolveServices } from "@/lab/presets";
import type { RawServiceEntry } from "@/lab/presets";
import type { ParsedLab } from "@/types/lab";
import type { LabData } from "@/types/browser";

export function parseLab(title: string, data: LabData): ParsedLab {
  return {
    title,
    instructions: data.instructions,
    filesPath: data.labDirPath,
    solutionPath: data.hasSolution ? data.solutionPath : undefined,
    workspace: data.config.workspace === "continue" ? "continue" : "fresh",
    testCommand: data.config.test,
    openFiles: data.config.open,
    services: resolveServices(data.config.services as readonly RawServiceEntry[]),
    setup: data.config.setup,
    start: data.config.start,
  };
}
