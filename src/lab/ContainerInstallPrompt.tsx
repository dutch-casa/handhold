import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Container, Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import type { ParsedLab } from "@/types/lab";

type RuntimeCheck =
  | { readonly kind: "ready" }
  | { readonly kind: "missing" };

type ContainerInstallPromptProps = {
  readonly lab: ParsedLab;
  readonly onRuntimeFound: () => void;
};

function detectPlatform(): "macos" | "linux" | "windows" | "unknown" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

function CopyCommand({ command }: { readonly command: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy command: ${command}`}
      className="focus-ring press group flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 font-mono text-sm transition-colors hover:bg-muted"
    >
      <code>{command}</code>
      {copied ? (
        <Check className="size-3.5 text-green-400" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
      )}
    </button>
  );
}

function InstallInstructions() {
  const platform = detectPlatform();

  switch (platform) {
    case "macos":
      return (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Install with Homebrew:</p>
          <CopyCommand command="brew install podman" />
        </div>
      );
    case "linux":
      return (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">Debian / Ubuntu:</p>
          <CopyCommand command="sudo apt install podman" />
          <p className="text-sm text-muted-foreground">Fedora / RHEL:</p>
          <CopyCommand command="sudo dnf install podman" />
        </div>
      );
    case "windows":
      return (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Download Docker Desktop:</p>
          <a
            href="https://docs.docker.com/desktop/setup/install/windows-install/"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring press flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-muted"
          >
            Docker Desktop for Windows
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      );
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Install <strong>Podman</strong> or <strong>Docker</strong> for your platform.
        </p>
      );
  }
}

export function ContainerInstallPrompt({ lab, onRuntimeFound }: ContainerInstallPromptProps) {
  const [checking, setChecking] = useState(false);

  async function handleCheckAgain() {
    setChecking(true);
    try {
      const result = await invoke<RuntimeCheck>("check_container_runtime");
      if (result.kind === "ready") {
        onRuntimeFound();
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Container className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-medium">This lab needs a container runtime</h2>
        <p className="text-sm text-muted-foreground">
          <strong>{lab.title}</strong> uses container services that require Podman or Docker.
        </p>
      </div>

      <InstallInstructions />

      <button
        type="button"
        onClick={handleCheckAgain}
        disabled={checking}
        aria-label={checking ? "Checking for container runtime" : "Check for container runtime again"}
        className="focus-ring press flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
      >
        <RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} aria-hidden="true" />
        {checking ? "Checking..." : "Check again"}
      </button>
    </div>
  );
}
