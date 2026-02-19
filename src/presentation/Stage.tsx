import { useRef, useLayoutEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCurrentScene, usePrevScene } from "./store";
import {
  slotInitial,
  slotExit,
  slotTransition,
  SLOT_ANIMATE,
  clearInitial,
  clearExit,
  clearDuration,
  CLEAR_ANIMATE,
} from "./animation-variants";
import { Code } from "@/code/Code";
import { Data } from "@/data/Data";
import { Diagram } from "@/diagram/Diagram";
import { Math as MathVis } from "@/math/Math";
import { Chart } from "@/chart/Chart";
import { Preview } from "@/preview/Preview";
import type { VisualizationState, SceneState, SlotEnterEffect, SceneAnnotation } from "@/types/lesson";
import { spacing } from "@/app/theme";

export function Stage() {
  const scene = useCurrentScene();
  const prevScene = usePrevScene();

  if (!scene) return null;

  const transition = scene.transition;
  const epoch = scene.epoch;

  return (
    <div style={{ padding: `${spacing.lg} ${spacing.xl}` }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={epoch}
          initial={clearInitial(transition)}
          animate={CLEAR_ANIMATE}
          exit={clearExit(transition)}
          transition={{ duration: clearDuration(transition) }}
        >
          <SlotLayer scene={scene} prevScene={prevScene} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SlotLayer({
  scene,
  prevScene,
}: {
  readonly scene: SceneState;
  readonly prevScene: SceneState | undefined;
}) {
  if (scene.slots.length === 0) return null;

  const isSplit = scene.slots.length > 1;

  return (
    <div
      style={{
        display: "flex",
        gap: spacing.lg,
        alignItems: "flex-start",
      }}
    >
      <AnimatePresence mode="popLayout">
        {scene.slots.map((slot) => {
          const enter = scene.enterEffects.find(
            (e) => e.target === slot.name,
          );
          const exit = scene.exitEffects.find(
            (e) => e.target === slot.name,
          );
          const isNew = !prevScene?.slots.some(
            (s) => s.name === slot.name,
          );
          const zoomScale =
            scene.zoom.scale !== 1 &&
            (scene.zoom.target === "" || scene.zoom.target === slot.name)
              ? scene.zoom.scale
              : 1;

          return (
            <motion.div
              key={slot.name}
              layout={zoomScale === 1 ? true : "position"}
              initial={isNew ? slotInitial(enter) : false}
              animate={SLOT_ANIMATE}
              exit={slotExit(exit)}
              transition={slotTransition(enter)}
              style={{ flex: isSplit ? "1 1 0%" : "1 1 100%" }}
            >
              <ViewportSlot zoomScale={zoomScale} pan={scene.pan}>
                <Slot
                  state={slot}
                  prevState={resolvePrevSlot(slot.name, scene, prevScene)}
                  enterEffect={enter}
                  focus={scene.focus}
                  flow={scene.flow}
                  pulse={scene.pulse}
                  trace={scene.trace}
                  draw={scene.draw}
                  pan={scene.pan}
                  annotations={scene.annotations}
                />
              </ViewportSlot>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// CSS approximation of theme spring (stiffness:120, damping:20, mass:1)
const VIEWPORT_TRANSITION = "transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), translate 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)";

function ViewportSlot({
  zoomScale,
  pan,
  children,
}: {
  readonly zoomScale: number;
  readonly pan: string;
  readonly children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prevScale = useRef(1);
  const prevPan = useRef("");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isZoomingIn = zoomScale > 1 && prevScale.current === 1;
    prevScale.current = zoomScale;

    if (!isZoomingIn) return;

    const focused = el.querySelectorAll<HTMLElement>("[data-focused]");
    if (focused.length === 0) return;

    const containerRect = el.getBoundingClientRect();
    if (containerRect.height === 0 || containerRect.width === 0) return;

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const f of focused) {
      const rect = f.getBoundingClientRect();
      sumY += rect.top + rect.height / 2;

      // Code lines span full container width (gutter + code + annotation).
      // For zoom centering, measure only the code text (children[1]) not the whole line.
      // SVG nodes are positioned, so their own center is correct.
      const FULL_WIDTH_RATIO = 0.9;
      const isFullWidth = rect.width / containerRect.width > FULL_WIDTH_RATIO;
      const contentChild = isFullWidth ? f.children[1] : undefined;
      if (contentChild) {
        const range = document.createRange();
        range.selectNodeContents(contentChild);
        const textRect = range.getBoundingClientRect();
        range.detach();
        sumX += textRect.width > 0
          ? textRect.left + textRect.width / 2
          : rect.left + rect.width / 2;
      } else {
        sumX += rect.left + rect.width / 2;
      }

      count++;
    }

    const avgX = sumX / count;
    const avgY = sumY / count;
    const relX = avgX - containerRect.left;
    const relY = avgY - containerRect.top;
    const xPct = Math.min(90, Math.max(10, (relX / containerRect.width) * 100));
    const yPct = Math.min(90, Math.max(10, (relY / containerRect.height) * 100));

    el.style.transformOrigin = `${xPct.toFixed(1)}% ${yPct.toFixed(1)}%`;
  }, [zoomScale]);

  // Compute pan translation from data-pan-target elements
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const panChanged = pan !== prevPan.current;
    prevPan.current = pan;

    if (pan.length === 0) {
      el.style.translate = "";
      return;
    }

    if (!panChanged) return;

    const targets = el.querySelectorAll<HTMLElement>("[data-pan-target]");
    if (targets.length === 0) return;

    const containerRect = el.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const t of targets) {
      const rect = t.getBoundingClientRect();
      sumX += rect.left + rect.width / 2;
      sumY += rect.top + rect.height / 2;
      count++;
    }

    const avgX = sumX / count;
    const avgY = sumY / count;
    const containerCenterX = containerRect.left + containerRect.width / 2;
    const containerCenterY = containerRect.top + containerRect.height / 2;
    const tx = containerCenterX - avgX;
    const ty = containerCenterY - avgY;

    el.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;
  }, [pan]);

  return (
    <div
      ref={ref}
      style={{
        transform: `scale(${zoomScale})`,
        transition: VIEWPORT_TRANSITION,
      }}
    >
      {children}
    </div>
  );
}

function findPrevSlot(
  name: string,
  prevScene: SceneState | undefined,
): VisualizationState | undefined {
  if (!prevScene) return undefined;
  return prevScene.slots.find((s) => s.name === name);
}

function resolvePrevSlot(
  name: string,
  scene: SceneState,
  prevScene: SceneState | undefined,
): VisualizationState | undefined {
  if (!prevScene) return undefined;
  const transform = scene.transformFrom.find((t) => t.to === name);
  if (transform) {
    return prevScene.slots.find((s) => s.name === transform.from);
  }
  return findPrevSlot(name, prevScene);
}

function Slot({
  state,
  prevState,
  enterEffect,
  focus,
  flow,
  pulse,
  trace,
  draw,
  pan,
  annotations,
}: {
  readonly state: VisualizationState;
  readonly prevState: VisualizationState | undefined;
  readonly enterEffect: SlotEnterEffect | undefined;
  readonly focus: string;
  readonly flow: string;
  readonly pulse: string;
  readonly trace: string;
  readonly draw: string;
  readonly pan: string;
  readonly annotations: readonly SceneAnnotation[];
}) {
  switch (state.kind) {
    case "code":
      return (
        <Code
          state={state}
          prevState={prevState?.kind === "code" ? prevState : undefined}
          enterEffect={enterEffect}
          focus={focus}
          pan={pan}
          annotations={annotations}
        />
      );
    case "data":
      return (
        <Data
          state={state}
          prevState={prevState?.kind === "data" ? prevState : undefined}
          focus={focus}
          flow={flow}
          pulse={pulse}
          trace={trace}
          draw={draw}
          pan={pan}
          annotations={annotations}
        />
      );
    case "diagram":
      return (
        <Diagram
          state={state}
          prevState={prevState?.kind === "diagram" ? prevState : undefined}
          focus={focus}
          flow={flow}
          pulse={pulse}
          trace={trace}
          draw={draw}
          pan={pan}
          annotations={annotations}
        />
      );
    case "math":
      return (
        <MathVis
          state={state}
          focus={focus}
        />
      );
    case "chart":
      return (
        <Chart
          state={state}
          focus={focus}
        />
      );
    case "preview":
      return (
        <Preview
          state={state}
          prevState={prevState?.kind === "preview" ? prevState : undefined}
        />
      );
  }
}
