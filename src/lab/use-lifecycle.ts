import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { scaffold, pathExists, wipeDir, isProvisioned, markProvisioned } from "@/lab/tauri/workspace";
import { exec } from "@/lab/tauri/runner";
import { composeUp, composeDown } from "@/lab/tauri/container";
import { generateComposeYaml } from "@/lab/compose";
import { writeFile } from "@/lab/tauri/file";
import type { ParsedLab, LabLifecycle, ServiceStatus } from "@/types/lab";

type RuntimeCheck =
  | { readonly kind: "ready"; readonly binary: string; readonly version: string }
  | { readonly kind: "missing" };

class ContainerMissingError extends Error {
  constructor() {
    super("No container runtime found");
    this.name = "ContainerMissingError";
  }
}

// Declarative lifecycle: React Query drives provisioning.
// The queryFn runs scaffold → setup scripts → services, streaming
// progress into the store via callbacks. The returned LabLifecycle
// is derived from the query state — never from a useEffect.

type LifecycleCallbacks = {
  readonly appendLog: (line: string) => void;
  readonly setServiceStatus: (name: string, status: ServiceStatus) => void;
};

type PostProvisionInit = {
  readonly openInitialFiles: () => void;
  readonly spawnTerminal: () => void;
};

async function provision(
  lab: ParsedLab,
  workspacePath: string,
  callbacks: LifecycleCallbacks,
  init: PostProvisionInit,
): Promise<true> {
  const { appendLog, setServiceStatus } = callbacks;

  // Pre-flight: verify container runtime before wasting time on scaffold/setup
  if (lab.services.length > 0) {
    const runtime = await invoke<RuntimeCheck>("check_container_runtime");
    if (runtime.kind === "missing") {
      throw new ContainerMissingError();
    }
  }

  const scaffoldPath = `${lab.filesPath}/scaffold`;
  const hasScaffold = await pathExists(scaffoldPath);

  // fresh: always wipe + scaffold + setup.
  // continue: DB-backed first-run detection — deterministic, no heuristic.
  const needsSetup = lab.workspace === "fresh" || !(await isProvisioned(workspacePath));

  if (lab.workspace === "fresh") {
    appendLog("Wiping workspace...");
    await wipeDir(workspacePath);
    if (hasScaffold) {
      appendLog("Scaffolding workspace...");
      await scaffold(scaffoldPath, workspacePath);
      appendLog("Workspace scaffolded.");
    }
  } else {
    if (needsSetup && hasScaffold) {
      appendLog("Scaffolding workspace (first run)...");
      await scaffold(scaffoldPath, workspacePath);
      appendLog("Workspace scaffolded.");
    }

    const overlayPath = `${lab.filesPath}/overlay`;
    const hasOverlay = await pathExists(overlayPath);
    if (hasOverlay) {
      appendLog("Applying overlay...");
      await scaffold(overlayPath, workspacePath);
      appendLog("Overlay applied.");
    }
  }

  if (lab.services.length > 0) {
    appendLog("Starting services...");

    const composeYaml = generateComposeYaml(lab.services);
    const composePath = `${workspacePath}/docker-compose.yml`;
    await writeFile(composePath, composeYaml);

    await composeUp(composePath, (event) => {
      switch (event.event) {
        case "serviceStarting":
          setServiceStatus(event.name, "starting");
          appendLog(`Starting ${event.name}...`);
          break;
        case "serviceHealthy":
          setServiceStatus(event.name, "healthy");
          appendLog(`${event.name} is healthy.`);
          break;
        case "serviceFailed":
          setServiceStatus(event.name, "failed");
          appendLog(`${event.name} failed: ${event.error}`);
          break;
        case "allHealthy":
          appendLog("All services healthy.");
          break;
        case "error":
          appendLog(`Service error: ${event.message}`);
          break;
      }
    });
  }

  if (needsSetup) {
    for (const script of lab.setup) {
      appendLog(`$ ${script}`);
      const exitCode = await exec(script, workspacePath, appendLog);
      if (exitCode !== 0) {
        throw new Error(`Setup script failed (exit ${exitCode}): ${script}`);
      }
    }
    await markProvisioned(workspacePath);
  } else if (lab.setup.length > 0) {
    appendLog("Workspace already provisioned — skipping setup.");
  }

  // Post-provisioning: open files and spawn terminal inside queryFn
  // so we don't need separate useEffects for one-time init.
  init.openInitialFiles();
  init.spawnTerminal();

  return true;
}

export function useLifecycle(
  lab: ParsedLab,
  workspacePath: string,
  callbacks: LifecycleCallbacks,
  init: PostProvisionInit,
): LabLifecycle {
  // Stable refs — prevent stale closures inside queryFn without
  // causing re-fetches when callback identity changes.
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;
  const initRef = useRef(init);
  initRef.current = init;

  const { data, error, isPending } = useQuery({
    queryKey: ["lab-provision", lab.filesPath, workspacePath],
    queryFn: () => provision(lab, workspacePath, cbRef.current, initRef.current),
    staleTime: Infinity,
    retry: false,
  });

  // Tear down compose services when the lab unmounts (navigation away or app close).
  // Mirrors the PTY cleanup pattern in use-terminals.ts.
  const composePath = `${workspacePath}/docker-compose.yml`;
  useEffect(() => {
    if (lab.services.length === 0) return;
    return () => {
      composeDown(composePath, false).catch(() => {});
    };
  }, [lab.services.length, composePath]);

  if (error) {
    if (error instanceof ContainerMissingError) {
      return { kind: "missing_runtime", lab };
    }
    return {
      kind: "failed",
      lab,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  if (isPending || !data) {
    return { kind: "provisioning", lab, workspacePath, log: [] };
  }
  return { kind: "ready", lab, workspacePath };
}
