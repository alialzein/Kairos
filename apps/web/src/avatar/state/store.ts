import { create } from "zustand";
import type { AvatarState } from "@twin/shared";
import type { Tier } from "@twin/config";
import { ZERO_ENERGY, type Energy } from "../audio/energy";
import { transition, type AvatarEvent } from "./machine";

export interface PointerState {
  /** world-space x/y on the z = 0 plane */
  x: number;
  y: number;
  active: boolean;
  /** +1 repel (hover), -1 attract (long press) */
  strength: number;
}
export interface FrameSummary {
  p50: number;
  p95: number;
  count: number;
}
/** Live overrides from the playground; every field optional, applied on top of AVATAR_STATES. */
export interface Tuning {
  turbulence?: number;
  brightness?: number;
  spring?: number;
  damping?: number;
  noiseScale?: number;
  noiseAmp?: number;
  size?: number;
  bloomStrength?: number;
  bloomThreshold?: number;
  vortex?: number;
  pointerRadius?: number;
}
export type Backend = "webgpu" | "webgl";

export interface AvatarStore {
  state: AvatarState;
  since: number;
  log: AvatarState[];
  tier: Tier | null;
  backend: Backend | null;
  ready: boolean;
  energy: Energy;
  pointer: PointerState;
  frames: FrameSummary;
  tuning: Tuning;
  dispatch: (e: AvatarEvent) => void;
  setState: (s: AvatarState) => void;
  setTier: (t: Tier) => void;
  setBackend: (b: Backend) => void;
  setReady: (r: boolean) => void;
  setEnergy: (e: Energy) => void;
  setPointer: (p: Partial<PointerState>) => void;
  setFrames: (f: FrameSummary) => void;
  setTuning: (t: Tuning) => void;
  reset: () => void;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const initial = () => ({
  state: "DORMANT" as AvatarState,
  since: now(),
  log: ["DORMANT" as AvatarState],
  tier: null,
  backend: null,
  ready: false,
  energy: ZERO_ENERGY,
  pointer: { x: 0, y: 0, active: false, strength: 1 },
  frames: { p50: 0, p95: 0, count: 0 },
  tuning: {},
});

export const useAvatarStore = create<AvatarStore>()((set, get) => ({
  ...initial(),
  dispatch: (e) => {
    const next = transition(get().state, e);
    if (next !== get().state) get().setState(next);
  },
  setState: (s) => set((st) => ({ state: s, since: now(), log: [...st.log, s].slice(-20) })),
  setTier: (tier) => set({ tier }),
  setBackend: (backend) => set({ backend }),
  setReady: (ready) => set({ ready }),
  setEnergy: (energy) => set({ energy }),
  setPointer: (p) => set((st) => ({ pointer: { ...st.pointer, ...p } })),
  setFrames: (frames) => set({ frames }),
  setTuning: (t) => set((st) => ({ tuning: { ...st.tuning, ...t } })),
  reset: () => set(initial()),
}));
