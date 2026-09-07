import {
  cos,
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  sin,
  time,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { AdditiveBlending, Color, Sprite, SpriteNodeMaterial, type Blending } from "three/webgpu";

/** sRGB hex → linear TSL vec3 (three's Color constructor does the sRGB → linear conversion). */
export function colorVec3(hex: string) {
  const c = new Color(hex);
  return vec3(c.r, c.g, c.b);
}

/**
 * The plan's point sizes are PointsMaterial units — px = size · (H/2) / depth, no fov term. A
 * sprite of world size s covers s · (H/2) / (depth · tan(fov/2)) px, so the sprite size that
 * matches a PointsMaterial `size` is size · tan(fov/2).
 */
export function spriteSizeForPointSize(size: number, fovDeg: number): number {
  return size * Math.tan((fovDeg * Math.PI) / 360);
}

/**
 * Phase 10 (Ali) shared sprite shape: a radial-gradient disc, white at the centre falling linearly
 * to transparent at the edge — 1 − clamp(length(uv − 0.5)·2, 0, 1), the TSL equivalent of a 64 px
 * canvas radial gradient. Softer than `shapeCircle()`, which is a hard-edged antialiased disc.
 */
export function softDisc() {
  const r = uv().sub(0.5).length().mul(2).clamp(0, 1);
  return float(1).sub(r);
}

export interface PointSpritesOptions {
  /** xyz per point */
  points: Float32Array;
  /** world size (see spriteSizeForPointSize). With `sizes`, this is the unit conversion factor:
   *  the final world size is size · sizes[i] · sizeJitter */
  size: number;
  color: string;
  opacity: number;
  /** 1 = `color`, 0 = white; mixes toward white (stars) */
  tint?: number;
  /** per-sprite multipliers hashed by instance index: [min, max] */
  sizeJitter?: [number, number];
  opacityJitter?: [number, number];
  /** per-point size multiplier (one float per point) in the same units as `size`, e.g. the
   *  landscape's per-node sizes in PointsMaterial units with size = spriteSizeForPointSize(1, fov) */
  sizes?: Float32Array;
  /** per-point opacity multiplier (one float per point), e.g. the landscape's bottom fade */
  opacities?: Float32Array;
  depthTest?: boolean;
  blending?: Blending;
  renderOrder?: number;
  /** Phase 10.4: a slow per-point wander in the sprite's xy plane — each point is offset by
   *  vec3(sin(ωt + h₁), cos(0.8ωt + h₂), 0)·amount with ω = 2π/period and h₁/h₂ hashed from the
   *  instance index, so no two points move together. Omit it (reduced motion) for static points. */
  drift?: { amount: number; period: number };
}

export interface PointSprites {
  sprite: Sprite;
  dispose(): void;
}

/** Per-point sine wander, hashed on the instance index so each sprite has its own phase. */
function driftOffset(d: { amount: number; period: number }) {
  const omega = (Math.PI * 2) / d.period;
  const h1 = hash(instanceIndex.add(7)).mul(Math.PI * 2);
  const h2 = hash(instanceIndex.add(11)).mul(Math.PI * 2);
  const t = time.mul(omega);
  return vec3(sin(t.add(h1)), cos(t.mul(0.8).add(h2)), 0).mul(d.amount);
}

/** One instanced draw of Ali's Phase 10 soft round sprites at static positions (the repo's
 *  Sparks.ts pattern): additive, no depth writes, size attenuation, never tone mapped. */
export function createPointSprites(o: PointSpritesOptions): PointSprites {
  const count = o.points.length / 3;
  const material = new SpriteNodeMaterial();
  const base = vec3(instancedArray(o.points, "vec3").element(instanceIndex));
  material.positionNode =
    o.drift && o.drift.amount > 0 && o.drift.period > 0 ? base.add(driftOffset(o.drift)) : base;
  const h = hash(instanceIndex.add(3));
  const jitter = (j: [number, number] | undefined) =>
    j ? float(j[0]).add(h.mul(j[1] - j[0])) : float(1);
  material.scaleNode = float(o.size)
    .mul(jitter(o.sizeJitter))
    .mul(o.sizes ? instancedArray(o.sizes, "float").element(instanceIndex) : float(1));
  const tint = o.tint ?? 1;
  const color = tint >= 1 ? colorVec3(o.color) : vec3(mix(vec3(1, 1, 1), colorVec3(o.color), tint));
  material.colorNode = vec4(color, 1);
  material.opacityNode = softDisc()
    .mul(o.opacity)
    .mul(jitter(o.opacityJitter))
    .mul(o.opacities ? instancedArray(o.opacities, "float").element(instanceIndex) : float(1));
  material.transparent = true;
  material.depthTest = o.depthTest ?? true;
  material.depthWrite = false;
  material.blending = o.blending ?? AdditiveBlending;
  material.toneMapped = false;
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  if (o.renderOrder !== undefined) sprite.renderOrder = o.renderOrder;
  return { sprite, dispose: () => material.dispose() };
}
