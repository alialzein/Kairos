import type { Rng } from "@/avatar/sim/random";
import type { Vec3 } from "../sceneConfig";

/**
 * Phase 11.4 (Ali) — the global dust volume: `count` points uniform in an axis-aligned box of
 * full extent `size` centred on `center` (world space, so the layer needs no object offset).
 * Uniform per axis: nothing bunches toward the middle, so the ambient particles read as an even
 * haze around the bust rather than a cloud stuck to it.
 */
export function boxPoints(o: { center: Vec3; size: Vec3; count: number }, rng: Rng): Float32Array {
  const n = Math.max(0, Math.floor(o.count));
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      out[i * 3 + a] = (o.center[a] ?? 0) + (rng() - 0.5) * (o.size[a] ?? 0);
    }
  }
  return out;
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
