import type {
  AnimationEffect,
  SlotEnterEffect,
  TransitionKind,
  EasingKind,
} from "@/types/lesson";
import { durations, spring as springConfig, fade as fadeConfig } from "@/app/theme";

// Data tables mapping closed enums → Motion values.
// No branching — the type system guarantees exhaustive coverage at the call site.

type MotionValues = Record<string, number>;
type MotionTransition = Record<string, unknown>;

// --- Slot-level (show/hide) ---

const ENTER: Record<AnimationEffect, MotionValues> = {
  fade: { opacity: 0 },
  slide: { opacity: 0, x: 40 },
  "slide-up": { opacity: 0, y: 40 },
  grow: { opacity: 0, scale: 0 },
  typewriter: { opacity: 1 },
  none: { opacity: 1 },
};

const EXIT: Record<AnimationEffect, MotionValues> = {
  fade: { opacity: 0 },
  slide: { opacity: 0, x: -40 },
  "slide-up": { opacity: 0, y: -40 },
  grow: { opacity: 0, scale: 0 },
  typewriter: { opacity: 0 },
  none: { opacity: 1 },
};

const EASING: Record<EasingKind, (d: number) => MotionTransition> = {
  spring: () => springConfig,
  "ease-out": (d) => ({ duration: d, ease: "easeOut" as const }),
  "ease-in-out": (d) => ({ duration: d, ease: "easeInOut" as const }),
  linear: (d) => ({ duration: d, ease: "linear" as const }),
};

const DEFAULT_FADE: MotionValues = { opacity: 0 };

export const SLOT_ANIMATE: MotionValues = { opacity: 1, x: 0, y: 0, scale: 1 };

export function slotInitial(effect: SlotEnterEffect | undefined): MotionValues {
  return effect ? ENTER[effect.effect] : DEFAULT_FADE;
}

export function slotExit(effect: SlotEnterEffect | undefined): MotionValues {
  return effect ? EXIT[effect.effect] : DEFAULT_FADE;
}

export function slotTransition(effect: SlotEnterEffect | undefined): MotionTransition {
  if (!effect) return { layout: springConfig, opacity: fadeConfig };
  return { layout: springConfig, ...EASING[effect.easing](effect.durationS) };
}

// --- Epoch-level (clear) ---

const CLEAR_ENTER: Record<TransitionKind, MotionValues> = {
  fade: { opacity: 0 },
  slide: { opacity: 0, x: 40 },
  instant: { opacity: 1 },
};

const CLEAR_EXIT: Record<TransitionKind, MotionValues> = {
  fade: { opacity: 0 },
  slide: { opacity: 0, x: -40 },
  instant: { opacity: 0 },
};

const CLEAR_DURATION: Record<TransitionKind, number> = {
  fade: durations.normal,
  slide: durations.normal,
  instant: 0,
};

export const CLEAR_ANIMATE: MotionValues = { opacity: 1, x: 0 };

export function clearInitial(transition: TransitionKind): MotionValues {
  return CLEAR_ENTER[transition];
}

export function clearExit(transition: TransitionKind): MotionValues {
  return CLEAR_EXIT[transition];
}

export function clearDuration(transition: TransitionKind): number {
  return CLEAR_DURATION[transition];
}
