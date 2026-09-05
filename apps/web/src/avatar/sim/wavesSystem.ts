import {
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  mx_noise_float,
  shapeCircle,
  time,
  vec3,
  vec4,
} from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from "three/webgpu";
import type { Palette } from "./palette";
import type { SimUniforms } from "./uniforms";

/** Background heightfield sheets: static points bobbed by noise in the vertex stage, no compute needed. */
export function createWaves(
  points: Float32Array,
  u: SimUniforms,
  palette: Palette,
): { sprite: Sprite; dispose(): void } {
  const count = points.length / 3;
  const base = instancedArray(points, "vec3");
  const material = new SpriteNodeMaterial();
  const p = base.element(instanceIndex);
  const bob = mx_noise_float(vec3(p.x.mul(0.8), p.z.mul(0.8), time.mul(0.12))).mul(0.15);
  material.positionNode = p.add(vec3(0, bob, 0));
  material.scaleNode = float(0.008).mul(float(0.6).add(hash(instanceIndex).mul(0.8)));
  const tint = mix(
    vec3(palette.deep.r, palette.deep.g, palette.deep.b),
    vec3(palette.particle.r, palette.particle.g, palette.particle.b),
    0.35,
  );
  material.colorNode = vec4(tint.mul(u.brightness).mul(0.5), 1);
  // See sim/compute.ts: shapeCircle()'s .d.ts return type lacks the arithmetic proxy, so reify via float().
  material.opacityNode = float(shapeCircle() as unknown as Parameters<typeof float>[0]).mul(0.35);
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return { sprite, dispose: () => material.dispose() };
}
