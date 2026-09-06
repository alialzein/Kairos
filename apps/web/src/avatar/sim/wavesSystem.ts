import {
  abs,
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  mx_noise_float,
  oneMinus,
  shapeCircle,
  sin,
  smoothstep,
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
  // Energy veins (avatar-polish T4): lightning-like streaks along noise iso-lines that flare
  // in slow pseudo-random bursts, so the range reads as alive rather than static dust.
  const veinField = oneMinus(abs(mx_noise_float(vec3(p.x.mul(0.4), p.z.mul(0.4), time.mul(0.05)))));
  const vein = smoothstep(0.93, 1.0, veinField);
  const flash = sin(time.mul(0.23))
    .mul(sin(time.mul(0.37).add(2)))
    .max(0)
    .pow(4);
  const veinGlow = vein.mul(flash).mul(3);
  const veinColor = vec3(palette.particle.r, palette.particle.g, palette.particle.b);
  material.colorNode = vec4(
    tint.mul(u.brightness).mul(0.5).add(veinColor.mul(veinGlow).mul(u.brightness)),
    1,
  );
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
