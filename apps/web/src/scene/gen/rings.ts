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
