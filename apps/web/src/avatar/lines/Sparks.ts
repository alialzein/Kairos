import {
  float,
  fract,
  hash,
  instanceIndex,
  instancedArray,
  mx_noise_float,
  shapeCircle,
  smoothstep,
  time,
  vec3,
  vec4,
} from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from "three/webgpu";
import type { Palette } from "../sim/palette";
import type { SimUniforms } from "../sim/uniforms";

export interface SpriteLayer {
  sprite: Sprite;
  dispose(): void;
}

/** Spark plume above the crown (look v2, L5): sprites that rise from their spawn point on a
 *  looping lifetime (phase from a per-particle seed), drift with noise, and fade with age.
 *  Emission follows treble; the whole plume fades with the humanoid weight. No compute pass. */
export function createSparks(
  points: Float32Array,
  seeds: Float32Array,
  u: SimUniforms,
  palette: Palette,
): SpriteLayer {
  const count = points.length / 3;
  const base = instancedArray(points, "vec3");
  const seed = instancedArray(seeds, "float");
  const material = new SpriteNodeMaterial();
  const p = base.element(instanceIndex);
  const s = seed.element(instanceIndex);
  const LIFE = 2.4;
  const age = fract(time.div(LIFE).add(s)); // 0..1, looping, phase per particle
  const rise = age.mul(0.7).mul(float(0.6).add(s.mul(0.8)));
  const sway = mx_noise_float(vec3(p.x.mul(6), age.mul(3).add(s.mul(10)), 0)).mul(0.08);
  material.positionNode = p.add(vec3(sway, rise, sway.mul(0.5)));
  material.scaleNode = float(0.006).mul(float(0.5).add(hash(instanceIndex).mul(1.2)));
  const cyan = vec3(palette.lineCyan.r, palette.lineCyan.g, palette.lineCyan.b);
  material.colorNode = vec4(cyan.mul(u.brightness).mul(1.8), 1);
  const fade = smoothstep(0, 0.12, age).mul(smoothstep(1, 0.55, age));
  const emission = float(0.35).add(u.treble.mul(0.65));
  material.opacityNode = float(shapeCircle() as unknown as Parameters<typeof float>[0])
    .mul(fade)
    .mul(emission)
    .mul(u.shade);
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return { sprite, dispose: () => material.dispose() };
}

/** Static starfield far behind the scene: tiny hashed-brightness points. */
export function createStarfield(
  points: Float32Array,
  u: SimUniforms,
  palette: Palette,
): SpriteLayer {
  const count = points.length / 3;
  const base = instancedArray(points, "vec3");
  const material = new SpriteNodeMaterial();
  material.positionNode = base.element(instanceIndex);
  const h = hash(instanceIndex.add(3));
  material.scaleNode = float(0.004).mul(float(0.4).add(h.mul(1.1)));
  const tint = vec3(palette.particle.r, palette.particle.g, palette.particle.b).mul(0.6).add(0.4);
  const twinkle = float(0.7).add(mx_noise_float(vec3(h.mul(40), time.mul(0.3), 0)).mul(0.3));
  material.colorNode = vec4(tint.mul(u.brightness).mul(twinkle).mul(0.9), 1);
  material.opacityNode = float(shapeCircle() as unknown as Parameters<typeof float>[0]).mul(
    float(0.25).add(h.mul(0.5)),
  );
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return { sprite, dispose: () => material.dispose() };
}
