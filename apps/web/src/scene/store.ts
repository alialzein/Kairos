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
  /** first frame rendered with the bust in the scene (or the bust layer off) */
  ready: boolean;
  /** the bust geometry is in the scene (set by Bust; true when the layer is off) */
  bustReady: boolean;
  /** asset load failure, e.g. the bust mesh */
  error: string | null;
  backend: SceneBackend | null;
  stats: SceneStats;
  setReady: (ready: boolean) => void;
  setBustReady: (bustReady: boolean) => void;
  setError: (error: string | null) => void;
  setBackend: (backend: SceneBackend) => void;
  setStats: (stats: SceneStats) => void;
  reset: () => void;
}

const initial = () => ({
  ready: false,
  bustReady: false,
  error: null,
  backend: null,
  stats: { p50: 0, p95: 0, count: 0 },
});

export const useSceneStore = create<SceneStore>()((set) => ({
  ...initial(),
  setReady: (ready) => set({ ready }),
  setBustReady: (bustReady) => set({ bustReady }),
  setError: (error) => set({ error }),
  setBackend: (backend) => set({ backend }),
  setStats: (stats) => set({ stats }),
  reset: () => set(initial()),
}));
