import type { ResolvedService } from "@/types/lab";

// Pure function: ResolvedService[] → docker-compose YAML string.
// No I/O, no side effects. The YAML is written to disk by the Tauri backend.

export function generateComposeYaml(
  services: readonly ResolvedService[],
): string {
  if (services.length === 0) return "";

  const serviceBlocks = services.map((svc) => {
    const lines: string[] = [];
    lines.push(`  ${svc.name}:`);
    lines.push(`    image: ${svc.image}`);

    if (svc.port > 0) {
      const host = svc.hostPort > 0 ? svc.hostPort : svc.port;
      lines.push(`    ports:`);
      lines.push(`      - "${host}:${svc.port}"`);
    }

    const envEntries = Object.entries(svc.env);
    if (envEntries.length > 0) {
      lines.push(`    environment:`);
      for (const [key, value] of envEntries) {
        lines.push(`      ${key}: "${value}"`);
      }
    }

    if (svc.healthcheck) {
      lines.push(`    healthcheck:`);
      lines.push(`      test: ["CMD-SHELL", "${svc.healthcheck}"]`);
      lines.push(`      interval: 2s`);
      lines.push(`      timeout: 5s`);
      lines.push(`      retries: 10`);
    }

    return lines.join("\n");
  });

  return `services:\n${serviceBlocks.join("\n\n")}\n`;
}
