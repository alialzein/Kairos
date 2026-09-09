import { create } from "zustand";
import type { AvatarState } from "@twin/shared";
import { ZERO_ENERGY, type Energy } from "../audio/energy";
import { transition, type AvatarEvent } from "./machine";

/**
 * The seven-state source of truth (docs/06 §3): the state machine's current state, its entry
 * time, a bounded log, the audio energy that modulates LISTENING/SPEAKING and WAKING's assembly
 * progress. Read per frame by the scene's `SceneStateDriver`, by `scene/Hud` and by the bench.
 * Renderer telemetry (backend, frame stats, errors) lives in `scene/store.ts`; the look v2 fields
 * (tier, pointer, tuning) went with that renderer (follow-up 3).
 */
export interface AvatarStore {
  state: AvatarState;
  /** `performance.now()` at the last state change (WAKING's assembly clock) */
  since: number;
  /** the last 20 states, oldest first */
  log: AvatarState[];
  energy: Energy;
  /** linear WAKING assembly progress 0..1 (0 outside WAKING) — drives the HUD "ASSEMBLING… NN%" */
  assemble: number;
  dispatch: (e: AvatarEvent) => void;
  setState: (s: AvatarState) => void;
  setEnergy: (e: Energy) => void;
  setAssemble: (a: number) => void;
  reset: () => void;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const initial = () => ({
  state: "DORMANT" as AvatarState,
  since: now(),
  log: ["DORMANT" as AvatarState],
  energy: ZERO_ENERGY,
  assemble: 0,
});

export const useAvatarStore = create<AvatarStore>()((set, get) => ({
  ...initial(),
  dispatch: (e) => {
    const next = transition(get().state, e);
    if (next !== get().state) get().setState(next);
  },
  setState: (s) => set((st) => ({ state: s, since: now(), log: [...st.log, s].slice(-20) })),
  setEnergy: (energy) => set({ energy }),
  setAssemble: (assemble) => set({ assemble }),
  reset: () => set(initial()),
}));
