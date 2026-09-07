import type { Noise3 } from "@/avatar/sim/noise";
import type { Rng } from "@/avatar/sim/random";
import type { SceneConfig } from "../sceneConfig";

export interface RingSpec {
  /** inner radius; the annulus spans radius..radius + thickness */
  radius: number;
  opacity: number;
}

/** Concentric ring radii and opacities (docs/plans/scene-plan.md Phase 6): `count` rings from
 *  `innerRadius` stepping outward by `step`, opacity fading from `opacityFrom` to `opacityTo`. */
export function ringSpecs(r: SceneConfig["rings"]): RingSpec[] {
  const n = Math.max(0, Math.floor(r.count));
  const out: RingSpec[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    out.push({
      radius: r.innerRadius + i * r.step,
      opacity: r.opacityFrom + (r.opacityTo - r.opacityFrom) * t,
    });
  }
  return out;
}

export interface RingPointsOptions {
  perRing: number;
  radialJitter: number;
  thickness: number;
  /** the angular density field — see `ringPoints` */
  density: { scale: number; floor: number };
  /** per-bead colour multiplier drawn uniformly from [min, max] */
  brightness: [number, number];
}

export interface RingPoints {
  /** xyz per accepted bead, ring-local */
  points: Float32Array;
  /** one colour multiplier per accepted bead */
  brightness: Float32Array;
  count: number;
}

/** how many angles may be drawn per accepted bead before `ringPoints` gives up — a degenerate
 *  density field (floor 0 with noise pinned low) would otherwise reject forever */
const MAX_ATTEMPTS_PER_POINT = 20;

/**
 * Phase 10.4 (Ali) — the beads on one ring: `perRing` points at the mid-annulus radius
 * (`spec.radius + thickness/2`) ± `radialJitter`, z 0. Local to the ring group, so they ride the
 * Phase 9 breathing scale when parented to the ring mesh.
 *
 * Phase 12.5 (Ali) — the angles are no longer uniform: an angle θ is rejection-sampled against the
 * density field
 *
 *   p(θ) = floor + (1 − floor)·(0.5 + 0.5·noise(cos θ·scale, sin θ·scale, ringIndex))
 *
 * so some arcs come out dense and some sparse. The noise is sampled on the unit circle rather than
 * on θ itself, which makes the field continuous across 2π (sampling noise(θ) would leave a seam
 * where θ wraps); `scale` sets how many dense/sparse lobes fit round a ring and `ringIndex` walks
 * the third noise axis so no two rings share a pattern. Each bead also carries a colour multiplier
 * drawn uniformly from `brightness` (> 1 feeds bloom on the half-float buffer).
 *
 * Deterministic in (`rng`, `noise`, `ringIndex`). Sampling stops after
 * `perRing · MAX_ATTEMPTS_PER_POINT` attempts, so a density field that accepts nothing returns
 * short rather than hanging; the returned arrays are always exactly `count` long.
 */
export function ringPoints(
  spec: RingSpec,
  o: RingPointsOptions,
  ringIndex: number,
  noise: Noise3,
  rng: Rng,
): RingPoints {
  const n = Math.max(0, Math.floor(o.perRing));
  const mid = spec.radius + o.thickness / 2;
  const points = new Float32Array(n * 3);
  const brightness = new Float32Array(n);
  const [bMin, bMax] = o.brightness;
  const { scale, floor } = o.density;
  const maxAttempts = n * MAX_ATTEMPTS_PER_POINT;
  let count = 0;
  for (let attempt = 0; count < n && attempt < maxAttempts; attempt++) {
    const a = rng() * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const p = floor + (1 - floor) * (0.5 + 0.5 * noise(cos * scale, sin * scale, ringIndex));
    if (rng() >= p) continue;
    const r = mid + (rng() * 2 - 1) * o.radialJitter;
    points[count * 3] = cos * r;
    points[count * 3 + 1] = sin * r;
    points[count * 3 + 2] = 0;
    brightness[count] = bMin + rng() * (bMax - bMin);
    count++;
  }
  return count === n
    ? { points, brightness, count }
    : { points: points.slice(0, count * 3), brightness: brightness.slice(0, count), count };
}
