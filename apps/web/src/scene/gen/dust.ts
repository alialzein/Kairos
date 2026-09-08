import type { Rng } from "@/avatar/sim/random";
import type { Vec3 } from "../sceneConfig";

/** Phase 13.3 (Ali): the density focus — the ambient cloud is misty around the head and sparse
 *  at the frame corners. A candidate at distance d from `center` is kept with probability
 *  1 / (1 + (d / falloff)²). */
export interface BoxFocus {
  center: Vec3;
  falloff: number;
}

/** Phase 13.3: rejection sampling stops after `count · ATTEMPTS_PER_POINT` draws, so a focus
 *  that accepts (almost) nothing can never hang the build — it returns the short array it filled.
 *  At the shipped ambient config the acceptance is ~0.2, i.e. ~5 attempts per kept point, so 50
 *  is a 10× margin. */
const ATTEMPTS_PER_POINT = 50;

/**
 * Phase 11.4 (Ali) — the global dust volume: `count` points uniform in an axis-aligned box of
 * full extent `size` centred on `center` (world space, so the layer needs no object offset).
 * Uniform per axis: nothing bunches toward the middle, so the ambient particles read as an even
 * haze around the bust rather than a cloud stuck to it.
 *
 * Phase 13.3 (Ali) — with `focus`, the draw is no longer uniform: a candidate is rejection-sampled
 * against 1 / (1 + (d / `focus.falloff`)²), d being its distance from `focus.center` (the head
 * centre), so the region inside the rings is misty and the far background stays sparse. The
 * returned array is `count` points long unless the attempt cap (`ATTEMPTS_PER_POINT` × `count`)
 * ran out first — a degenerate focus (a `falloff` at or below 0, or so small nothing is accepted)
 * returns a SHORTER array, and callers must size themselves off `length / 3`, not off `count`.
 * Deterministic per rng; without `focus` the draw and the rng consumption are unchanged.
 */
export function boxPoints(
  o: { center: Vec3; size: Vec3; count: number; focus?: BoxFocus },
  rng: Rng,
): Float32Array {
  const n = Math.max(0, Math.floor(o.count));
  const out = new Float32Array(n * 3);
  if (!o.focus) {
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < 3; a++) {
        out[i * 3 + a] = (o.center[a] ?? 0) + (rng() - 0.5) * (o.size[a] ?? 0);
      }
    }
    return out;
  }
  const { center, falloff } = o.focus;
  const scale = falloff * falloff; // d² is compared in units of falloff², so no sqrt per candidate
  let kept = 0;
  for (let attempt = 0; kept < n && attempt < n * ATTEMPTS_PER_POINT; attempt++) {
    let d2 = 0;
    for (let a = 0; a < 3; a++) {
      const v = (o.center[a] ?? 0) + (rng() - 0.5) * (o.size[a] ?? 0);
      out[kept * 3 + a] = v;
      const dv = v - (center[a] ?? 0);
      d2 += dv * dv;
    }
    // a NaN weight (falloff 0 at d = 0) fails the comparison, so it rejects rather than throws
    if (rng() < 1 / (1 + d2 / scale)) kept++;
  }
  return kept === n ? out : out.slice(0, kept * 3);
}

export interface PlumeSeeds {
  /** (ux, uz) per particle: a uniform sample of the unit disc (r = √u), the particle's lane in
   *  the cone — the shader scales it by the cone radius at its current height */
  disc: Float32Array;
  /** rise phase per particle, 0..1 — the offset into the fract() rise cycle, so at any instant
   *  the cone is filled from base to tip. Also the still position under reduced motion. */
  phase: Float32Array;
  /** per-particle rise-speed multiplier, drawn uniformly from `speedJitter` */
  speed: Float32Array;
}

/**
 * Phase 11.4 (Ali) — the crown plume's per-particle seeds. Everything the plume animates is
 * derived from these three arrays on TSL `time`, so the layer allocates nothing per frame:
 * the particle rises from the crown to `height` over `period / speed` seconds, wraps back to the
 * base, and its lateral lane never changes.
 */
export function plumeSeeds(
  o: { count: number; speedJitter: [number, number] },
  rng: Rng,
): PlumeSeeds {
  const n = Math.max(0, Math.floor(o.count));
  const disc = new Float32Array(n * 2);
  const phase = new Float32Array(n);
  const speed = new Float32Array(n);
  const [s0, s1] = o.speedJitter;
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()); // √u: uniform over the disc, not bunched at the centre
    disc[i * 2] = Math.cos(a) * r;
    disc[i * 2 + 1] = Math.sin(a) * r;
    phase[i] = rng();
    speed[i] = s0 + rng() * (s1 - s0);
  }
  return { disc, phase, speed };
}
