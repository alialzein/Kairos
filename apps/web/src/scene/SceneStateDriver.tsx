"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { WAKING_DURATION_S } from "@twin/config";
import { useAvatarStore } from "@/avatar/state/store";
import { sceneMotionEnabled } from "./motion";
import { sceneConfig } from "./sceneConfig";
import { stateUniforms } from "./stateUniforms";
import { copyLook, currentLook, listeningLook, SceneStateEngine, SCENE_STATES } from "./states";
import { useSceneStore } from "./store";

/** how often the driver writes WAKING's assembly progress to the store (a React re-render of the
 *  HUD block each time — 20 Hz is plenty for a percentage) */
const ASSEMBLE_INTERVAL_MS = 50;

/**
 * Seven-state wiring (b5-32, Ali's design): the one thing that turns the avatar's state machine
 * into the scene's look. Owns a `SceneStateEngine`, blends one `SceneLook` per frame and writes it
 * into the shared `stateUniforms` (for the shaders) and `currentLook` (for the two layers that
 * animate in JS). No remounts, no new layers, nothing allocated per frame.
 *
 * Mounted INSIDE the Canvas (it needs `useFrame`) and after the layers in the JSX, but its frame
 * callback is subscribed at priority −1 so it runs FIRST every frame — R3F sorts subscribers by
 * priority ascending and only a priority > 0 takes rendering into its own hands, so a negative
 * priority orders the callback without touching the render loop. Without it Rings/NeckCircuit,
 * which mount earlier, would read the previous frame's look.
 *
 * Canvas-isolation rule (docs/plans/phase-b5-ledger.md, Task 7): this component subscribes to the
 * avatar store through `useAvatarStore.subscribe` and reads it through `getState()`, never through
 * the hook — it renders once, returns null and never re-renders, so the Canvas's parent is never
 * disturbed.
 *
 * Phases (`pulsePhase`, `scrollOffset`, `plumeClock`) are ACCUMULATED rather than derived from the
 * elapsed time: `time · rate` would jump the moment a state changes the rate. Under reduced motion
 * nothing accumulates (the phases stay 0, which is exactly what each layer's `time · 0` produced
 * before) and the engine collapses the tweens and zeroes the pulse amplitude.
 */
export function SceneStateDriver() {
  const engine = useMemo(() => {
    // the bench applies `?set=` after this module was loaded, so re-derive the identity row from
    // the live config first: LISTENING is BY DEFINITION the merged sceneConfig's own look
    copyLook(listeningLook(), SCENE_STATES.LISTENING.look);
    return new SceneStateEngine(
      SCENE_STATES,
      useAvatarStore.getState().state,
      !sceneMotionEnabled(),
    );
  }, []);
  const motion = useMemo(() => sceneMotionEnabled(), []);
  /** whether this driver is the thing feeding WAKING's assembly bar (nothing else does on the bench) */
  const ownsAssemble = useRef(false);
  const assembleWrittenMs = useRef(0);

  useEffect(() => {
    // a `?state=WAKING` preview arms the bar without ever firing a subscription
    const at = useAvatarStore.getState();
    ownsAssemble.current = at.state === "WAKING" && at.assemble === 0;
    return useAvatarStore.subscribe((s, prev) => {
      if (s.state === prev.state) return;
      engine.set(s.state, performance.now());
      // `useAvatarState` drives `assemble` when the app runs it; on the bench nothing does, so
      // the driver takes it over for a wake that arrives with the progress still at 0
      ownsAssemble.current = s.state === "WAKING" && s.assemble === 0;
      assembleWrittenMs.current = 0;
      if (prev.state === "WAKING" && s.assemble !== 0) useAvatarStore.getState().setAssemble(0);
    });
  }, [engine]);

  useFrame((_, delta) => {
    const now = performance.now();
    const store = useAvatarStore.getState();
    const hold = useSceneStore.getState().hold;
    const look = engine.update(now, store.energy.mid, hold ?? undefined);
    copyLook(look, currentLook);

    const u = stateUniforms;
    u.coreColor.value.set(look.coreColor[0], look.coreColor[1], look.coreColor[2]);
    u.coreIntensity.value = look.coreIntensity;
    u.corePulseAmount.value = look.corePulseAmount;
    u.plumeFraction.value = look.plumeFraction;
    u.neckBrightness.value = look.neckBrightness;
    u.goldBrightness.value = look.goldBrightness;
    u.dustDrift.value = look.dustDrift;

    const scrollRate = sceneConfig.contours.scrollSpeed * look.contourScroll;
    if (!motion) {
      // still scene: the phases the layers read stay where they started (the old `time · 0`)
    } else if (hold !== null) {
      // `?hold=` pins the clock for a still: derive the phases from it instead of accumulating,
      // so the same URL always produces the same frame
      u.pulsePhase.value =
        look.corePulsePeriod > 0 ? ((Math.PI * 2) / look.corePulsePeriod) * hold : 0;
      u.scrollOffset.value = scrollRate * hold;
      u.plumeClock.value = look.plumeSpeed * hold;
    } else {
      if (look.corePulsePeriod > 0) {
        u.pulsePhase.value += ((Math.PI * 2) / look.corePulsePeriod) * delta;
      }
      u.scrollOffset.value += scrollRate * delta;
      u.plumeClock.value += look.plumeSpeed * delta;
    }

    if (ownsAssemble.current && store.state === "WAKING") {
      const spec = engine.spec;
      const durationMs = spec.sequenceMs ?? WAKING_DURATION_S * 1000;
      const elapsed = hold !== null ? hold * 1000 : now - store.since;
      if (now - assembleWrittenMs.current >= ASSEMBLE_INTERVAL_MS) {
        assembleWrittenMs.current = now;
        useAvatarStore.getState().setAssemble(Math.min(1, elapsed / durationMs));
      }
    }
  }, -1);

  return null;
}
