import { usePresentationStore } from "./store";
import { colors, fonts, fontSizes, spacing, radii } from "@/app/theme";

// Step list with progress indicators.
// Completed steps show a filled circle. Current step pulses.

export function Sidebar() {
  const steps = usePresentationStore((s) => s.steps);
  const currentIndex = usePresentationStore((s) => s.currentStepIndex);
  const completedIds = usePresentationStore((s) => s.completedStepIds);
  const goToStep = usePresentationStore((s) => s.goToStep);
  const title = usePresentationStore((s) => s.lesson?.title ?? "");

  return (
    <nav
      style={{
        width: "260px",
        borderRight: `1px solid ${colors.border}`,
        padding: `${spacing.lg} 0`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "auto",
      }}
    >
      <div
        style={{
          padding: `0 ${spacing.lg} ${spacing.lg}`,
          fontFamily: fonts.ui,
          fontSize: fontSizes.body,
          fontWeight: 600,
          color: colors.text,
          borderBottom: `1px solid ${colors.border}`,
          marginBottom: spacing.md,
          paddingBottom: spacing.lg,
        }}
      >
        {title}
      </div>
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex;
        const isCompleted = completedIds.has(step.id);

        return (
          <button
            key={step.id}
            onClick={() => goToStep(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.lg}`,
              border: "none",
              background: isCurrent ? colors.surface : "transparent",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: fonts.ui,
              fontSize: fontSizes.codeSmall,
              color: isCurrent ? colors.text : isCompleted ? colors.textMuted : colors.textDim,
              borderRadius: radii.sm,
              margin: `0 ${spacing.sm}`,
              minHeight: "44px", // touch target
              transition: "background 0.15s ease-out, color 0.15s ease-out",
            }}
            onMouseEnter={(e) => {
              if (!isCurrent) e.currentTarget.style.background = colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              if (!isCurrent) e.currentTarget.style.background = "transparent";
            }}
          >
            <StepIndicator isCurrent={isCurrent} isCompleted={isCompleted} />
            <span style={{ flex: 1 }}>{step.title}</span>
          </button>
        );
      })}
    </nav>
  );
}

function StepIndicator({ isCurrent, isCompleted }: { isCurrent: boolean; isCompleted: boolean }) {
  const size = 10;
  const color = isCompleted ? colors.success : isCurrent ? colors.accent : colors.border;

  return (
    <svg width={size + 4} height={size + 4} viewBox={`0 0 ${size + 4} ${size + 4}`}>
      <circle
        cx={(size + 4) / 2}
        cy={(size + 4) / 2}
        r={size / 2}
        fill={isCompleted ? color : "none"}
        stroke={color}
        strokeWidth={1.5}
      >
        {isCurrent && (
          <animate
            attributeName="r"
            values={`${size / 2};${size / 2 + 1.5};${size / 2}`}
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>
    </svg>
  );
}
