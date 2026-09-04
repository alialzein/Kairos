import type { AvatarState } from "@twin/shared";

export const SHAPES = ["HUMANOID", "ORB", "NEBULA", "RING"] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_ID: Record<Shape, number> = { HUMANOID: 0, ORB: 1, NEBULA: 2, RING: 3 };

export type Easing = "linear" | "easeInOutCubic" | "easeOutExpo";

export interface CorePulse {
  /** seconds per pulse */
  period: number;
  /** brightness floor 0..1 */
  min: number;
  /** brightness ceiling 0..1 */
  max: number;
}

export interface StateParams {
  shape: Shape;
  /** 0..1, scales the noise flow (docs/06 §3) */
  turbulence: number;
  /** overall particle brightness multiplier */
  brightness: number;
  corePulse: CorePulse;
  /** RGB multiplier applied to every particle colour */
  tint: [number, number, number];
  /** seconds for the morph into this state (0.4–1.2 s; OFFLINE 2 s) */
  morphDuration: number;
  easing: Easing;
  /** ±scale breathing amplitude (ORB) */
  breathing: number;
  /** 0..1 swirl strength around the head anchor (THINKING) */
  vortex: number;
  /** how much audio energy adds to turbulence */
  audioGain: number;
  /** chromatic aberration amount for the post pass (WAKING) */
  aberration: number;
}

export const AVATAR_STATES: Record<AvatarState, StateParams> = {
  DORMANT: {
    shape: "NEBULA",
    turbulence: 0.15,
    brightness: 0.35,
    corePulse: { period: 6, min: 0.15, max: 0.35 },
    tint: [0.7, 0.8, 1.0],
    morphDuration: 1.2,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 0,
    audioGain: 0,
    aberration: 0,
  },
  IDLE: {
    shape: "ORB",
    turbulence: 0.25,
    brightness: 0.7,
    corePulse: { period: 3, min: 0.45, max: 0.75 },
    tint: [1, 1, 1],
    morphDuration: 1.0,
    easing: "easeInOutCubic",
    breathing: 0.03,
    vortex: 0,
    audioGain: 0,
    aberration: 0,
  },
  WAKING: {
    shape: "HUMANOID",
    turbulence: 0.9,
    brightness: 1.25,
    corePulse: { period: 1.2, min: 0.9, max: 1.0 },
    tint: [1.05, 1.1, 1.25],
    morphDuration: 1.2,
    easing: "easeOutExpo",
    breathing: 0,
    vortex: 0,
    audioGain: 0,
    aberration: 1,
  },
  LISTENING: {
    shape: "HUMANOID",
    turbulence: 0.2,
    brightness: 0.9,
    corePulse: { period: 3, min: 0.55, max: 0.85 },
    tint: [1, 1, 1],
    morphDuration: 0.6,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 0,
    audioGain: 0.4,
    aberration: 0,
  },
  THINKING: {
    shape: "HUMANOID",
    turbulence: 0.6,
    brightness: 0.95,
    corePulse: { period: 1.2, min: 0.6, max: 1.0 },
    tint: [1.0, 0.95, 0.9],
    morphDuration: 0.5,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 1,
    audioGain: 0,
    aberration: 0,
  },
  SPEAKING: {
    shape: "HUMANOID",
    turbulence: 0.3,
    brightness: 1.0,
    corePulse: { period: 2, min: 0.7, max: 1.0 },
    tint: [1, 1, 1],
    morphDuration: 0.4,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 0,
    audioGain: 0.5,
    aberration: 0,
  },
  OFFLINE: {
    shape: "NEBULA",
    turbulence: 0.8,
    brightness: 0.5,
    corePulse: { period: 0.5, min: 0.15, max: 0.5 },
    tint: [1.0, 0.45, 0.45],
    morphDuration: 2.0,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 0,
    audioGain: 0,
    aberration: 0,
  },
};

export type Tier = "ultra" | "high" | "mid" | "low";
export interface TierParams {
  particles: number;
  /** particle count of the background waves system (0 = off) */
  waves: number;
  bloom: "full" | "cheap" | "off";
  /** 0 = render one static frame (reduced motion) */
  targetFps: number;
  /** devicePixelRatio cap (docs/06 §7) */
  dprCap: number;
}
export const TIERS: Record<Tier, TierParams> = {
  ultra: { particles: 400_000, waves: 60_000, bloom: "full", targetFps: 60, dprCap: 2 },
  high: { particles: 150_000, waves: 40_000, bloom: "full", targetFps: 60, dprCap: 2 },
  mid: { particles: 60_000, waves: 15_000, bloom: "cheap", targetFps: 30, dprCap: 1.5 },
  low: { particles: 20_000, waves: 0, bloom: "off", targetFps: 0, dprCap: 1 },
};
export const TIER_ORDER: readonly Tier[] = ["ultra", "high", "mid", "low"];

export const WAKING_DURATION_S = 1.2;
export const IDLE_TIMEOUT_S = 90;
/** fraction of particles reserved for the CORE and SPINE sub-systems (docs/06 §2) */
export const ROLE_SPLIT = { core: 0.05, spine: 0.02 } as const;
