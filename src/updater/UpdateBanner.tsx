import { useState, useCallback } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import type { Update } from "@tauri-apps/plugin-updater";
import { useUpdateCheck } from "./use-update-check";
import { colors } from "@/app/theme";

type Phase =
  | { readonly kind: "available" }
  | { readonly kind: "downloading"; readonly percent: number }
  | { readonly kind: "restarting" };

export function UpdateBanner() {
  const { data: update } = useUpdateCheck();
  const [phase, setPhase] = useState<Phase>({ kind: "available" });
  const [dismissed, setDismissed] = useState(false);

  const install = useCallback(async (u: Update) => {
    setPhase({ kind: "downloading", percent: 0 });
    let total = 0;
    let downloaded = 0;
    await u.downloadAndInstall((ev) => {
      switch (ev.event) {
        case "Started":
          total = ev.data.contentLength ?? 0;
          break;
        case "Progress":
          downloaded += ev.data.chunkLength;
          if (total > 0) {
            setPhase({
              kind: "downloading",
              percent: Math.min(100, Math.round((downloaded / total) * 100)),
            });
          }
          break;
        case "Finished":
          setPhase({ kind: "downloading", percent: 100 });
          break;
      }
    });
    setPhase({ kind: "restarting" });
    await relaunch();
  }, []);

  if (!update || dismissed) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 16px",
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        fontSize: "13px",
        color: colors.text,
      }}
    >
      {phase.kind === "available" && (
        <>
          <span style={{ flex: 1 }}>
            Handhold <strong>v{update.version}</strong> is available.
          </span>
          <button onClick={() => install(update)} style={buttonStyle}>
            Install update
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={dismissStyle}
            aria-label="Dismiss update banner"
          >
            &times;
          </button>
        </>
      )}

      {phase.kind === "downloading" && (
        <>
          <span style={{ flex: 1 }}>Downloading update...</span>
          <div style={trackStyle}>
            <div
              style={{ ...fillStyle, width: `${phase.percent}%` }}
            />
          </div>
          <span style={{ color: colors.textMuted, minWidth: "36px" }}>
            {phase.percent}%
          </span>
        </>
      )}

      {phase.kind === "restarting" && (
        <span style={{ flex: 1 }}>Restarting...</span>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: "6px",
  border: "none",
  background: colors.accent,
  color: colors.bg,
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const dismissStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: colors.textMuted,
  fontSize: "18px",
  cursor: "pointer",
  padding: "0 4px",
  lineHeight: 1,
};

const trackStyle: React.CSSProperties = {
  width: "120px",
  height: "6px",
  borderRadius: "3px",
  background: colors.border,
  overflow: "hidden",
};

const fillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "3px",
  background: colors.accent,
  transition: "width 0.2s ease-out",
};
