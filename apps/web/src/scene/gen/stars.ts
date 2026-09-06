import type { Rng } from "@/avatar/sim/random";

export interface StarFieldOptions {
  count: number;
  /** distance from the camera to the near edge of the shell */
  radius: number;
  /** shell thickness */
  depth: number;
  /** vertical field of view in degrees */
  fovDeg: number;
  /** widest aspect ratio to cover */
  aspect: number;
  /** camera position (stars are placed relative to it, looking down −z) */
  camera: readonly [number, number, number];
  /** extra cone width (1 = exactly the frustum) */
  margin?: number;
}

/**
 * Star positions inside the camera's view cone, on a shell `radius..radius+depth` away
 * (docs/plans/scene-plan.md Phase 1). Sampling the cone instead of a full sphere makes `count`
 * the number of stars on screen, which is what "halve the count if distracting" tunes.
 * Deterministic for a given rng.
 */
export function starPositions(o: StarFieldOptions, rng: Rng): Float32Array {
  const out = new Float32Array(o.count * 3);
  const tanH = Math.tan((o.fovDeg * Math.PI) / 360);
  const margin = o.margin ?? 1.1;
  const [cx, cy, cz] = o.camera;
  for (let i = 0; i < o.count; i++) {
    const nx = (rng() * 2 - 1) * margin;
    const ny = (rng() * 2 - 1) * margin;
    const r = o.radius + rng() * o.depth;
    const dx = nx * tanH * o.aspect;
    const dy = ny * tanH;
    const len = Math.hypot(dx, dy, 1);
    out[i * 3] = cx + (dx / len) * r;
    out[i * 3 + 1] = cy + (dy / len) * r;
    out[i * 3 + 2] = cz - (1 / len) * r;
  }
  return out;
}
