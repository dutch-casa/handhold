import { useCurrentStepNumber, useTotalSteps, usePresentationStore } from "./store";
import { colors, fonts, fontSizes, spacing, radii } from "@/app/theme";

// Play/pause, step navigation, speed, and step progress.
// Keyboard shortcuts handled at the Presentation level (onKeyDown on focusable container).

type ControlsProps = {
  readonly onNext: () => void;
};

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

export function Controls({ onNext }: ControlsProps) {
  const togglePlayPause = usePresentationStore((s) => s.togglePlayPause);
  const status = usePresentationStore((s) => s.status);
  const prevStep = usePresentationStore((s) => s.prevStep);
  const playbackRate = usePresentationStore((s) => s.playbackRate);
  const setPlaybackRate = usePresentationStore((s) => s.setPlaybackRate);
  const current = useCurrentStepNumber();
  const total = useTotalSteps();

  return (
    <div style={barStyle}>
      <ControlButton onClick={prevStep} label="Previous step" disabled={current <= 1}>
        <ArrowLeftIcon />
      </ControlButton>

      <ControlButton onClick={togglePlayPause} label={status === "playing" ? "Pause" : "Play"}>
        {status === "playing" ? <PauseIcon /> : <PlayIcon />}
      </ControlButton>

      <ControlButton onClick={onNext} label="Next step">
        <ArrowRightIcon />
      </ControlButton>

      <span style={counterStyle}>
        {current} / {total}
      </span>

      <SpeedSelector rate={playbackRate} onChange={setPlaybackRate} />
    </div>
  );
}

// --- Control Button ---

function ControlButton({
  onClick,
  label,
  disabled,
  children,
}: {
  readonly onClick: () => void;
  readonly label: string;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      style={{
        ...controlButtonBase,
        color: disabled ? colors.textDim : colors.text,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = colors.surface;
      }}
    >
      {children}
    </button>
  );
}

// --- Speed Selector ---

function SpeedSelector({ rate, onChange }: { readonly rate: number; readonly onChange: (r: number) => void }) {
  return (
    <div style={speedContainerStyle}>
      {SPEED_OPTIONS.map((speed) => {
        const active = speed === rate;
        return (
          <button
            key={speed}
            onClick={() => onChange(speed)}
            aria-label={`${speed}x speed`}
            style={{
              ...speedButtonBase,
              background: active ? colors.accent : "transparent",
              color: active ? colors.bg : colors.textMuted,
              fontWeight: active ? 600 : 400,
            }}
          >
            {speed}x
          </button>
        );
      })}
    </div>
  );
}

// --- Static Styles ---

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing.lg,
  padding: `${spacing.md} ${spacing.lg}`,
  borderTop: `1px solid ${colors.border}`,
  fontFamily: fonts.ui,
  fontSize: fontSizes.codeSmall,
};

const counterStyle: React.CSSProperties = {
  color: colors.textDim,
  marginLeft: spacing.md,
  fontVariantNumeric: "tabular-nums",
};

const controlButtonBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "44px",
  height: "44px",
  border: `1px solid ${colors.border}`,
  borderRadius: radii.md,
  background: colors.surface,
  transition: "background 0.15s ease-out, opacity 0.15s ease-out",
};

const speedContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing.xs,
  marginLeft: "auto",
  padding: `${spacing.xs} ${spacing.sm}`,
  borderRadius: radii.md,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
};

const speedButtonBase: React.CSSProperties = {
  padding: `${spacing.xs} ${spacing.sm}`,
  borderRadius: radii.sm,
  border: "none",
  fontFamily: fonts.ui,
  fontSize: "12px",
  fontVariantNumeric: "tabular-nums",
  cursor: "pointer",
  transition: "background 0.15s ease-out, color 0.15s ease-out",
};

// --- Icons ---

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="3.5" height="12" rx="0.5" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="0.5" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}
