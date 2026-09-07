import {
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  shapeCircle,
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

export interface PointSpritesOptions {
  /** xyz per point */
  points: Float32Array;
  /** world size (see spriteSizeForPointSize) */
  size: number;
  color: string;
  opacity: number;
  /** 1 = `color`, 0 = white; mixes toward white (stars) */
  tint?: number;
  /** per-sprite multipliers hashed by instance index: [min, max] */
  sizeJitter?: [number, number];
  opacityJitter?: [number, number];
  /** per-point opacity multiplier (one float per point), e.g. the landscape's bottom fade */
  opacities?: Float32Array;
  depthTest?: boolean;
  blending?: Blending;
  renderOrder?: number;
}

export interface PointSprites {
  sprite: Sprite;
  dispose(): void;
}

/** One instanced draw of round sprites at static positions (the repo's Sparks.ts pattern). */
export function createPointSprites(o: PointSpritesOptions): PointSprites {
  const count = o.points.length / 3;
  const material = new SpriteNodeMaterial();
  material.positionNode = instancedArray(o.points, "vec3").element(instanceIndex);
  const h = hash(instanceIndex.add(3));
  const jitter = (j: [number, number] | undefined) =>
    j ? float(j[0]).add(h.mul(j[1] - j[0])) : float(1);
  material.scaleNode = float(o.size).mul(jitter(o.sizeJitter));
  const tint = o.tint ?? 1;
  const color = tint >= 1 ? colorVec3(o.color) : vec3(mix(vec3(1, 1, 1), colorVec3(o.color), tint));
  material.colorNode = vec4(color, 1);
  // shapeCircle is typed as a bare Node in @types/three 0.185.4 (same gap as avatar/lines/Sparks.ts)
  material.opacityNode = float(shapeCircle() as unknown as Parameters<typeof float>[0])
    .mul(o.opacity)
    .mul(jitter(o.opacityJitter))
    .mul(o.opacities ? instancedArray(o.opacities, "float").element(instanceIndex) : float(1));
  material.transparent = true;
  material.depthTest = o.depthTest ?? true;
  material.depthWrite = false;
  material.blending = o.blending ?? AdditiveBlending;
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  if (o.renderOrder !== undefined) sprite.renderOrder = o.renderOrder;
  return { sprite, dispose: () => material.dispose() };
}
