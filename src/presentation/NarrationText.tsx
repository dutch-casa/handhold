import { useMemo } from "react";
import { usePresentationStore } from "./store";
import { colors, fonts, fontSizes, spacing } from "@/app/theme";

// Shows one sentence at a time during playback. All sentences visible when idle.
// Current word gets accent highlight + scale. Words reveal progressively as TTS speaks.

type Sentence = {
  readonly words: readonly string[];
  readonly startIndex: number;
  readonly endIndex: number;
};

const SENTENCE_END = /[.?!]$/;
const BIG_O = /^O\(/;

function splitIntoSentences(words: readonly string[]): readonly Sentence[] {
  const sentences: Sentence[] = [];
  let start = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (SENTENCE_END.test(word) && !BIG_O.test(word)) {
      sentences.push({ words: words.slice(start, i + 1), startIndex: start, endIndex: i });
      start = i + 1;
    }
  }
  if (start < words.length) {
    sentences.push({ words: words.slice(start), startIndex: start, endIndex: words.length - 1 });
  }
  return sentences;
}

export function NarrationText() {
  const step = usePresentationStore((s) => s.steps[s.currentStepIndex]);
  const currentWordIndex = usePresentationStore((s) => s.currentWordIndex);
  const status = usePresentationStore((s) => s.status);

  const words = useMemo(() => {
    if (!step) return [];
    return step.narration.flatMap((block) =>
      block.text.split(/\s+/).filter(Boolean),
    );
  }, [step]);

  const sentences = useMemo(() => splitIntoSentences(words), [words]);

  if (words.length === 0) return null;

  const showAll = status === "idle";

  // Only render active sentences — no display:none, no hidden DOM nodes.
  // When playing but no word event yet (-1), show the first sentence so the screen isn't blank.
  const visible = showAll
    ? sentences
    : currentWordIndex < 0
      ? sentences.slice(0, 1)
      : sentences.filter(
          (s) => currentWordIndex >= s.startIndex && currentWordIndex <= s.endIndex,
        );

  return (
    <div style={containerStyle}>
      {visible.map((sentence) => (
        <SentenceView
          key={sentence.startIndex}
          sentence={sentence}
          currentWordIndex={currentWordIndex}
          showAll={showAll}
        />
      ))}
    </div>
  );
}

function SentenceView({
  sentence,
  currentWordIndex,
  showAll,
}: {
  readonly sentence: Sentence;
  readonly currentWordIndex: number;
  readonly showAll: boolean;
}) {
  return (
    <>
      {sentence.words.map((word, wi) => {
        const globalIdx = sentence.startIndex + wi;
        const isCurrent = globalIdx === currentWordIndex;
        const isPast = globalIdx < currentWordIndex;
        const revealed = showAll || isPast || isCurrent;

        return (
          <span
            key={globalIdx}
            style={{
              display: "inline-block",
              marginRight: "0.35em",
              color: isCurrent ? colors.accent : isPast ? colors.text : colors.textMuted,
              opacity: revealed ? 1 : 0,
              transform: isCurrent ? "scale(1.05)" : undefined,
              transition: "color 0.15s ease-out, transform 0.15s ease-out, opacity 0.2s ease-out",
            }}
          >
            {word}
          </span>
        );
      })}
    </>
  );
}

const containerStyle: React.CSSProperties = {
  fontFamily: fonts.ui,
  fontSize: fontSizes.body,
  lineHeight: "1.8",
  color: colors.textMuted,
  padding: `${spacing.sm} ${spacing.md}`,
  maxWidth: "720px",
  margin: "0 auto",
  minHeight: "3.6em",
};
