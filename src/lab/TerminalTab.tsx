import { useRef, useEffect } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import type { TerminalHandle } from "@/lab/tauri/terminal";
import "@xterm/xterm/css/xterm.css";

// Deep module: hides xterm.js lifecycle, PTY data channels, resize plumbing.
// Takes a TerminalHandle (live PTY connection) and renders it.
// Self-contained — mount/unmount is the only lifecycle boundary.

type TerminalTabProps = {
  readonly handle: TerminalHandle;
  readonly visible: boolean;
};

export function TerminalTab({ handle, visible }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  // Create terminal once, wire to PTY handle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrainsMono Nerd Font Mono', 'JetBrainsMono Nerd Font', 'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#f1efe8",
        cursor: "#f1efe8",
        cursorAccent: "#0a0a0a",
        selectionBackground: "#ffffff20",
        selectionForeground: "#f1efe8",
        black: "#2a2a2a",
        red: "#f87171",
        green: "#7ee787",
        yellow: "#ffa657",
        blue: "#79c0ff",
        magenta: "#d2a8ff",
        cyan: "#a5d6ff",
        white: "#f1efe8",
        brightBlack: "#555550",
        brightRed: "#ffa198",
        brightGreen: "#9be9a8",
        brightYellow: "#ffcb6b",
        brightBlue: "#a5d6ff",
        brightMagenta: "#e2cbff",
        brightCyan: "#c8e1ff",
        brightWhite: "#ffffff",
      },
      scrollback: 10000,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // PTY → xterm
    const dataSub = handle.onData((data) => term.write(data));

    // xterm → PTY
    const inputDisposable = term.onData((data) => {
      handle.write(data);
    });

    // Resize xterm → PTY
    const resizeDisposable = term.onResize(({ rows, cols }) => {
      handle.resize(rows, cols);
    });

    // Observe container size → fit
    const observer = new ResizeObserver(() => {
      fit.fit();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      resizeDisposable.dispose();
      inputDisposable.dispose();
      dataSub.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [handle]);

  // Re-fit when visibility changes (tab switch)
  useEffect(() => {
    if (visible) {
      fitRef.current?.fit();
      termRef.current?.focus();
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: visible ? "block" : "none",
      }}
    />
  );
}
