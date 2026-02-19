import type { AnimationEffect, AnimationOverride, EasingKind } from "@/types/lesson";
import { DEFAULT_ANIMATION } from "@/types/lesson";

// Closed sets — forward-compatible: unknown tokens are silently ignored.
const EFFECTS: ReadonlySet<string> = new Set<AnimationEffect>([
  "fade",
  "slide",
  "slide-up",
  "grow",
  "typewriter",
  "none",
]);

const EASINGS: ReadonlySet<string> = new Set<EasingKind>([
  "ease-out",
  "ease-in-out",
  "spring",
  "linear",
  "reveal",
  "emphasis",
  "handoff",
]);

const DURATION_RE = /^(\d+(?:\.\d+)?)(s|ms)$/;

/** Classifies trailing DSL tokens into an animation override. Empty tokens = default. */
export function parseAnimationTokens(
  tokens: readonly string[],
): AnimationOverride {
  if (tokens.length === 0) return DEFAULT_ANIMATION;

  let effect: AnimationEffect = "fade";
  let durationS = 0.3;
  let easing: EasingKind = "ease-out";
  let hasAny = false;

  for (const token of tokens) {
    if (EFFECTS.has(token)) {
      effect = token as AnimationEffect;
      hasAny = true;
      continue;
    }

    if (EASINGS.has(token)) {
      easing = token as EasingKind;
      hasAny = true;
      continue;
    }

    const m = DURATION_RE.exec(token);
    if (m) {
      const value = Number(m[1]);
      durationS = m[2] === "ms" ? value / 1000 : value;
      hasAny = true;
    }
  }

  if (!hasAny) return DEFAULT_ANIMATION;
  return { kind: "custom", effect, durationS, easing };
}

export function isAnimationToken(token: string): boolean {
  if (EFFECTS.has(token as AnimationEffect)) return true;
  if (EASINGS.has(token as EasingKind)) return true;
  return DURATION_RE.test(token);
}
