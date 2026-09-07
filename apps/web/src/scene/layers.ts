import { LAYER_NAMES, sceneConfig, type LayerName, type Layers } from "./sceneConfig";

/** The plan phase in which each layer first appears (docs/plans/scene-plan.md, component tree). */
export const LAYER_PHASE: Record<LayerName, number> = {
  background: 1,
  stars: 1,
  bust: 2,
  contours: 3,
  shell: 10,
  core: 4,
  neck: 5,
  rings: 6,
  landscape: 7,
  post: 8,
  hud: 8,
};

export interface LayerQuery {
  /** enable exactly the layers introduced up to this phase (0 = nothing) */
  phase?: string;
  /** comma list of layers to switch off */
  off?: string;
  /** comma list: switch everything off except these */
  only?: string;
}

const list = (v: string | undefined): LayerName[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is LayerName => (LAYER_NAMES as readonly string[]).includes(s));

/** Layer flags for /bench/scene: config defaults, then `phase`, then `only`, then `off`. */
export function layersFromQuery(q: LayerQuery): Layers {
  const out: Layers = { ...sceneConfig.layers };
  const phase = q.phase === undefined ? NaN : Number(q.phase);
  if (Number.isFinite(phase)) {
    for (const l of LAYER_NAMES) out[l] = LAYER_PHASE[l] <= phase;
  }
  const only = list(q.only);
  if (only.length) {
    for (const l of LAYER_NAMES) out[l] = only.includes(l);
  }
  for (const l of list(q.off)) out[l] = false;
  return out;
}
