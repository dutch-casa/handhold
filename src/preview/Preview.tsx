import { useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { PreviewState } from "@/types/lesson";
import { useCompilePreview } from "./use-compile-preview";
import { colors, radii, fade } from "@/app/theme";

type PreviewProps = {
  readonly state: PreviewState;
  readonly prevState: PreviewState | undefined;
};

export function Preview({ state }: PreviewProps) {
  const { data: compiledHtml, isLoading, error } = useCompilePreview(
    state.source,
    state.template,
  );

  const srcdoc = state.template === "html" ? state.source : compiledHtml;

  if (isLoading && state.template === "react") {
    return (
      <div style={containerStyle}>
        <div style={placeholderStyle}>Compiling JSX...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={errorStyle}>
          {error instanceof Error ? error.message : "Compilation failed"}
        </div>
      </div>
    );
  }

  if (!srcdoc) return null;

  return (
    <div style={containerStyle}>
      <AnimatePresence mode="wait">
        <motion.div
          key={srcdoc}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          style={{ width: "100%"  }}
        >
          <PreviewIframe srcdoc={srcdoc} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PreviewIframe({ srcdoc }: { readonly srcdoc: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    iframe.style.height = `${doc.documentElement.scrollHeight}px`;
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Preview"
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      onLoad={handleLoad}
      style={iframeStyle}
    />
  );
}

const containerStyle: React.CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: radii.lg,
  background: "#ffffff",
  overflow: "hidden",
};

const iframeStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  display: "block",
  minHeight: 48,
};

const placeholderStyle: React.CSSProperties = {
  padding: 24,
  color: colors.textMuted,
  textAlign: "center",
};

const errorStyle: React.CSSProperties = {
  padding: 24,
  color: colors.error,
  fontFamily: "monospace",
  fontSize: 14,
  whiteSpace: "pre-wrap",
};
