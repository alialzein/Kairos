import type { AvatarState } from "@twin/shared";
import { AVATAR_STATES, SHAPE_ID, type StateParams } from "@twin/config";
import type { Energy } from "../audio/energy";
import type { PointerState, Tuning } from "../state/store";
import { Morph } from "./morph";

export interface FrameInput {
  state: AvatarState;
  /** seconds — when `state` was entered (same clock as `now`) */
  since: number;
  now: number;
  dt: number;
  energy: Energy;
  pointer: PointerState;
  tuning: Tuning;
}

export interface UniformValues {
  shapeA: number;
  shapeB: number;
  morph: number;
  turbulence: number;
  brightness: number;
  tint: [number, number, number];
  corePulse: number;
  coreHeat: number;
  breathing: number;
  vortex: number;
  bass: number;
  mid: number;
  treble: number;
  speak: number;
  listen: number;
  freeze: number;
  spring: number;
  damping: number;
  noiseScale: number;
  noiseAmp: number;
  size: number;
  alpha: number;
  pointer: [number, number, number];
  pointerStrength: number;
  pointerRadius: number;
  aberration: number;
}

export interface FrameMemory {
  lastState: AvatarState;
  morph: Morph;
  /** for WAKING's two-step flourish and OFFLINE's freeze */
  phase: number;
}

export const DEFAULTS = {
  spring: 12,
  damping: 0.9,
  noiseScale: 1.6,
  noiseAmp: 0.9,
  size: 0.012,
  alpha: 0.85,
  pointerRadius: 0.5,
} as const;
const OFFLINE_FREEZE_S = 0.4;
const WAKING_RING_S = 0.45;

export function initialMemory(state: AvatarState): FrameMemory {
  return { lastState: state, morph: new Morph(SHAPE_ID[AVATAR_STATES[state].shape]), phase: 0 };
}

function plan(state: AvatarState, p: StateParams, elapsed: number, mem: FrameMemory): void {
  if (state === "WAKING") {
    if (mem.phase === 0) {
      mem.morph.start(SHAPE_ID.RING, 0.4, "easeOutExpo");
      mem.phase = 1;
    }
    if (mem.phase === 1 && elapsed >= WAKING_RING_S) {
      mem.morph.start(SHAPE_ID.HUMANOID, p.morphDuration - WAKING_RING_S, p.easing);
      mem.phase = 2;
    }
    return;
  }
  if (state === "OFFLINE") {
    if (mem.phase === 0 && elapsed >= OFFLINE_FREEZE_S) {
      mem.morph.start(SHAPE_ID.NEBULA, p.morphDuration, p.easing);
      mem.phase = 1;
    }
    return;
  }
  if (mem.phase === 0) {
    mem.morph.start(SHAPE_ID[p.shape], p.morphDuration, p.easing);
    mem.phase = 1;
  }
}

export function computeFrame(
  input: FrameInput,
  prev: FrameMemory,
): { values: UniformValues; memory: FrameMemory } {
  const mem = prev;
  const p = AVATAR_STATES[input.state];
  const elapsed = Math.max(0, input.now - input.since);
  if (input.state !== mem.lastState) {
    mem.lastState = input.state;
    mem.phase = 0;
  }
  plan(input.state, p, elapsed, mem);
  mem.morph.update(input.dt);

  const t = input.tuning;
  const pulsePhase = 0.5 + 0.5 * Math.sin((input.now * Math.PI * 2) / p.corePulse.period);
  const corePulse = p.corePulse.min + (p.corePulse.max - p.corePulse.min) * pulsePhase;
  const e = input.energy;
  const freeze = input.state === "OFFLINE" && elapsed < OFFLINE_FREEZE_S ? 1 : 0;
  const coreHeat = input.state === "THINKING" ? 0.8 : Math.min(1, 0.3 + e.bass * 0.6);

  const values: UniformValues = {
    shapeA: mem.morph.shapeA,
    shapeB: mem.morph.shapeB,
    morph: mem.morph.eased,
    turbulence: t.turbulence ?? p.turbulence,
    brightness: t.brightness ?? p.brightness,
    tint: p.tint,
    corePulse,
    coreHeat,
    breathing: p.breathing,
    vortex: t.vortex ?? p.vortex,
    bass: e.bass,
    mid: e.mid,
    treble: e.treble,
    speak: input.state === "SPEAKING" ? e.mid * p.audioGain : 0,
    listen: input.state === "LISTENING" ? e.mid * p.audioGain : 0,
    freeze,
    spring: t.spring ?? DEFAULTS.spring,
    damping: t.damping ?? DEFAULTS.damping,
    noiseScale: t.noiseScale ?? DEFAULTS.noiseScale,
    noiseAmp: t.noiseAmp ?? DEFAULTS.noiseAmp,
    size: t.size ?? DEFAULTS.size,
    alpha: DEFAULTS.alpha,
    pointer: [input.pointer.x, input.pointer.y, 0],
    pointerStrength: input.pointer.active ? input.pointer.strength : 0,
    pointerRadius: t.pointerRadius ?? DEFAULTS.pointerRadius,
    aberration:
      input.state === "WAKING" ? p.aberration * Math.max(0, 1 - elapsed / p.morphDuration) : 0,
  };
  return { values, memory: mem };
}
