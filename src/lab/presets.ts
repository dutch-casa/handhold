import { SERVICE_PRESETS } from "@/types/service-preset";
import type { PresetName, ServicePreset } from "@/types/service-preset";
import type { ResolvedService } from "@/types/lab";

// Resolve a service entry from a lab manifest.
// Accepts either a preset name string or a full custom definition.
// Custom definitions override preset defaults shallowly.

export type RawServiceEntry =
  | string
  | {
      readonly name: string;
      readonly image?: string;
      readonly port?: number;
      readonly hostPort?: number;
      readonly env?: Readonly<Record<string, string>>;
      readonly healthcheck?: string;
    };

function isPresetName(name: string): name is PresetName {
  return name in SERVICE_PRESETS;
}

export function resolveService(entry: RawServiceEntry): ResolvedService {
  if (typeof entry === "string") {
    if (!isPresetName(entry)) {
      throw new Error(`Unknown service preset: "${entry}"`);
    }
    const preset = SERVICE_PRESETS[entry];
    return { name: entry, ...preset, hostPort: 0 };
  }

  // Custom definition — look up preset for defaults, override with provided fields
  const preset: ServicePreset | undefined = isPresetName(entry.name)
    ? SERVICE_PRESETS[entry.name]
    : undefined;

  if (!preset && !entry.image) {
    throw new Error(
      `Service "${entry.name}" is not a known preset and has no image specified`,
    );
  }

  return {
    name: entry.name,
    image: entry.image ?? preset!.image,
    port: entry.port ?? preset?.port ?? 0,
    hostPort: entry.hostPort ?? 0,
    env: { ...preset?.env, ...entry.env },
    healthcheck: entry.healthcheck ?? preset?.healthcheck ?? "",
  };
}

export function resolveServices(
  entries: readonly RawServiceEntry[],
): readonly ResolvedService[] {
  return entries.map(resolveService);
}
