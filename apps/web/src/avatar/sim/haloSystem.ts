import {
  atan,
  float,
  hash,
  instanceIndex,
  instancedArray,
  shapeCircle,
  sin,
  time,
  vec3,
  vec4,
} from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from "three/webgpu";
import { HALO_CENTER } from "./targets/halo";
import type { Palette } from "./palette";
import type { SimUniforms } from "./uniforms";

/** Halo rings behind the head: static ring points with an angular shimmer sweeping around
 *  them, faded in by the humanoid `shade` weight so they only accompany the bust. */
export function createHalo(
  points: Float32Array,
  u: SimUniforms,
  palette: Palette,
): { sprite: Sprite; dispose(): void } {
  const count = points.length / 3;
  const base = instancedArray(points, "vec3");
  const material = new SpriteNodeMaterial();
  const p = base.element(instanceIndex);
  material.positionNode = p;
  material.scaleNode = float(0.007).mul(float(0.6).add(hash(instanceIndex).mul(0.8)));
  const angle = atan(p.y.sub(HALO_CENTER[1]), p.x.sub(HALO_CENTER[0]));
  const shimmer = float(0.5).add(sin(angle.mul(2).add(time.mul(0.7))).mul(0.5));
  const tint = vec3(palette.particle.r, palette.particle.g, palette.particle.b);
  material.colorNode = vec4(
    tint
      .mul(u.brightness)
      .mul(u.shade)
      .mul(float(0.4).add(shimmer.mul(1.1))),
    1,
  );
  // See sim/compute.ts: shapeCircle()'s .d.ts return type lacks the arithmetic proxy, so reify via float().
  material.opacityNode = float(shapeCircle() as unknown as Parameters<typeof float>[0])
    .mul(0.4)
    .mul(u.shade);
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return { sprite, dispose: () => material.dispose() };
}
