import type {
  SceneState,
  SlotEnterEffect,
  VisualizationState,
  NarrationBlock,
  TriggerVerb,
  AnimationOverride,
} from "@/types/lesson";

// Scene reducer — pure function run at parse time.
// Produces the full scenes[] array. Runtime just indexes into it.

const EMPTY_SCENE: SceneState = {
  slots: [],
  transition: "fade",
  enterEffects: [],
  exitEffects: [],
  epoch: 0,
  focus: "",
  flow: "",
  pulse: "",
  trace: "",
  transformFrom: [],
  annotations: [],
  zoom: { scale: 1, target: "" },
  pan: "",
  draw: "",
};

export function buildSceneSequence(
  blocks: ReadonlyMap<string, VisualizationState>,
  narration: readonly NarrationBlock[],
): readonly SceneState[] {
  const allTriggers = narration.flatMap((b) => b.triggers);
  const hasVerbTriggers = allTriggers.some(
    (t) => t.action.verb !== "advance",
  );

  if (!hasVerbTriggers) {
    return buildLegacySequence(blocks, allTriggers.length);
  }

  return buildVerbSequence(blocks, allTriggers);
}

// --- Legacy: sequential advance ---

function buildLegacySequence(
  blocks: ReadonlyMap<string, VisualizationState>,
  triggerCount: number,
): readonly SceneState[] {
  const blockList = [...blocks.values()];
  if (blockList.length === 0) return [EMPTY_SCENE];

  const scenes: SceneState[] = [];

  const first = blockList[0];
  if (first) {
    scenes.push({ ...EMPTY_SCENE, slots: [first] });
  }

  for (let i = 0; i < triggerCount; i++) {
    const blockIdx = i + 1;
    const block = blockList[blockIdx];
    if (block) {
      scenes.push({ ...EMPTY_SCENE, slots: [block] });
    } else {
      const last = scenes[scenes.length - 1];
      if (last) scenes.push(last);
    }
  }

  return scenes;
}

// --- Verb-driven scene building ---

type BuildState = {
  scene: SceneState;
  splitMode: boolean;
  shownOrder: string[];
};

function buildVerbSequence(
  blocks: ReadonlyMap<string, VisualizationState>,
  triggers: readonly { readonly action: TriggerVerb }[],
): readonly SceneState[] {
  const state: BuildState = {
    scene: EMPTY_SCENE,
    splitMode: false,
    shownOrder: [],
  };

  const scenes: SceneState[] = [EMPTY_SCENE];

  for (const trigger of triggers) {
    applyVerb(state, trigger.action, blocks);
    scenes.push({ ...state.scene });
  }

  return scenes;
}

function extractEffect(
  target: string,
  animation: AnimationOverride,
): readonly SlotEnterEffect[] {
  if (animation.kind !== "custom") return [];
  return [
    {
      target,
      effect: animation.effect,
      durationS: animation.durationS,
      easing: animation.easing,
    },
  ];
}

function applyVerb(
  state: BuildState,
  verb: TriggerVerb,
  blocks: ReadonlyMap<string, VisualizationState>,
): void {
  // Reset per-transition effects so they don't leak across scenes.
  state.scene = { ...state.scene, enterEffects: [], exitEffects: [] };

  switch (verb.verb) {
    case "show": {
      const block = blocks.get(verb.target);
      if (!block) return;

      const enterEffects = extractEffect(verb.target, verb.animation);

      if (state.splitMode) {
        const alreadyShown = state.scene.slots.some(
          (s) => s.name === verb.target,
        );
        if (!alreadyShown) {
          state.scene = {
            ...state.scene,
            slots: [...state.scene.slots, block],
            enterEffects,
          };
          state.shownOrder.push(verb.target);
        }
      } else {
        state.scene = { ...state.scene, slots: [block], enterEffects };
        state.shownOrder = [verb.target];
      }
      return;
    }

    case "show-group": {
      const enterEffects = verb.targets.flatMap((target) =>
        extractEffect(target, verb.animation),
      );
      const nextSlots = [...state.scene.slots];
      for (const target of verb.targets) {
        const block = blocks.get(target);
        if (!block) continue;
        const alreadyShown = nextSlots.some((s) => s.name === target);
        if (!alreadyShown) {
          nextSlots.push(block);
          state.shownOrder.push(target);
        }
      }
      state.scene = { ...state.scene, slots: nextSlots, enterEffects };
      return;
    }

    case "hide": {
      const exitEffects = extractEffect(verb.target, verb.animation);

      state.scene = {
        ...state.scene,
        slots: state.scene.slots.filter((s) => s.name !== verb.target),
        exitEffects,
      };
      state.shownOrder = state.shownOrder.filter((n) => n !== verb.target);
      return;
    }

    case "hide-group": {
      const exitEffects = verb.targets.flatMap((target) =>
        extractEffect(target, verb.animation),
      );
      state.scene = {
        ...state.scene,
        slots: state.scene.slots.filter((s) => !verb.targets.includes(s.name)),
        exitEffects,
      };
      state.shownOrder = state.shownOrder.filter(
        (n) => !verb.targets.includes(n),
      );
      return;
    }

    case "transform": {
      const fromBlock = blocks.get(verb.from);
      const toBlock = blocks.get(verb.to);
      if (!fromBlock || !toBlock) return;

      const nextSlots = state.scene.slots.map((slot) =>
        slot.name === verb.from ? toBlock : slot,
      );
      const enterEffects = extractEffect(verb.to, verb.animation);
      const exitEffects = extractEffect(verb.from, verb.animation);

      state.scene = {
        ...state.scene,
        slots: nextSlots,
        enterEffects,
        exitEffects,
        transformFrom: [
          ...state.scene.transformFrom,
          { from: verb.from, to: verb.to },
        ],
      };
      state.shownOrder = state.shownOrder.map((n) =>
        n === verb.from ? verb.to : n,
      );
      return;
    }

    case "clear": {
      state.scene = {
        ...EMPTY_SCENE,
        transition: verb.transition,
        epoch: state.scene.epoch + 1,
      };
      state.shownOrder = [];
      return;
    }

    case "split": {
      state.splitMode = true;
      return;
    }

    case "unsplit": {
      state.splitMode = false;
      const lastSlot = state.scene.slots[state.scene.slots.length - 1];
      if (lastSlot) {
        state.scene = { ...state.scene, slots: [lastSlot] };
        state.shownOrder = [lastSlot.name];
      }
      return;
    }

    case "focus": {
      state.scene = {
        ...state.scene,
        focus: verb.target === "none" ? "" : verb.target,
      };
      return;
    }

    case "pulse": {
      state.scene = {
        ...state.scene,
        pulse: verb.target === "none" ? "" : verb.target,
      };
      return;
    }

    case "trace": {
      state.scene = {
        ...state.scene,
        trace: verb.target === "none" ? "" : verb.target,
      };
      return;
    }

    case "annotate": {
      // Single annotation per target — replace any existing on same target
      const filtered = state.scene.annotations.filter(
        (a) => a.target !== verb.target,
      );
      state.scene = {
        ...state.scene,
        annotations: [...filtered, { target: verb.target, text: verb.text }],
      };
      return;
    }

    case "zoom": {
      state.scene = {
        ...state.scene,
        zoom: { scale: verb.scale, target: verb.target },
      };
      return;
    }

    case "flow": {
      state.scene = {
        ...state.scene,
        flow: verb.target === "none" ? "" : verb.target,
      };
      return;
    }

    case "pan": {
      state.scene = {
        ...state.scene,
        pan: verb.target === "none" ? "" : verb.target,
      };
      return;
    }

    case "draw": {
      state.scene = {
        ...state.scene,
        draw: verb.target === "none" ? "" : verb.target,
      };
      return;
    }

    case "play": {
      return;
    }

    case "advance": {
      const shownSet = new Set(state.shownOrder);
      for (const [name, block] of blocks) {
        if (!shownSet.has(name)) {
          if (state.splitMode) {
            state.scene = {
              ...state.scene,
              slots: [...state.scene.slots, block],
            };
          } else {
            state.scene = { ...state.scene, slots: [block] };
          }
          state.shownOrder.push(name);
          return;
        }
      }
      return;
    }
  }
}
