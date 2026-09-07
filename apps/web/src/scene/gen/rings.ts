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

/**
 * Phase 10.4 (Ali) — the beads on one ring: `perRing` points at a uniform random angle, at the
 * mid-annulus radius (`spec.radius + thickness/2`) ± `radialJitter`, z 0. Local to the ring
 * group, so they ride the Phase 9 breathing scale when parented to the ring mesh.
 */
export function ringPoints(
  spec: RingSpec,
  o: { perRing: number; radialJitter: number; thickness: number },
  rng: Rng,
): Float32Array {
  const n = Math.max(0, Math.floor(o.perRing));
  const mid = spec.radius + o.thickness / 2;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = mid + (rng() * 2 - 1) * o.radialJitter;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = Math.sin(a) * r;
    out[i * 3 + 2] = 0;
  }
  return out;
}

/**
 * Phase 10.4 (Ali) — the faint drifting dust around the head: `count` points uniform in a disc of
 * `radius` in x/y (r = radius·√u, so the disc fills evenly rather than bunching at the centre)
 * with z uniform in `depth`. Centred on the origin; the layer offsets it to `bust.headCenter`.
 */
export function driftPoints(
  o: { count: number; radius: number; depth: [number, number] },
  rng: Rng,
): Float32Array {
  const n = Math.max(0, Math.floor(o.count));
  const out = new Float32Array(n * 3);
  const [z0, z1] = o.depth;
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * o.radius;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = Math.sin(a) * r;
    out[i * 3 + 2] = z0 + rng() * (z1 - z0);
  }
  return out;
}
