import { create } from "zustand";

export type SceneBackend = "webgpu" | "webgl";
export interface SceneStats {
  p50: number;
  p95: number;
  count: number;
}

/** Bench/telemetry state for the scene canvas. Written by the canvas, read by /bench/scene; the
 *  canvas's parent never subscribes (docs/plans/phase-b5-ledger.md, Task 7 canvas-isolation rule). */
export interface SceneStore {
  ready: boolean;
  backend: SceneBackend | null;
  stats: SceneStats;
  setReady: (ready: boolean) => void;
  setBackend: (backend: SceneBackend) => void;
  setStats: (stats: SceneStats) => void;
  reset: () => void;
}

const initial = () => ({ ready: false, backend: null, stats: { p50: 0, p95: 0, count: 0 } });

export const useSceneStore = create<SceneStore>()((set) => ({
  ...initial(),
  setReady: (ready) => set({ ready }),
  setBackend: (backend) => set({ backend }),
  setStats: (stats) => set({ stats }),
  reset: () => set(initial()),
}));
