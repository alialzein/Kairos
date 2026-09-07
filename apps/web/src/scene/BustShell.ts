import {
  cameraPosition,
  distance,
  float,
  instanceIndex,
  instancedArray,
  mix,
  oneMinus,
  smoothstep,
  vec3,
  vec4,
} from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial, type BufferGeometry } from "three/webgpu";
import { mulberry32 } from "@/avatar/sim/random";
import { currentVerticalFov } from "./framing";
import { sampleShell } from "./gen/shell";
import type { SceneConfig } from "./sceneConfig";
import { colorVec3, softDisc, spriteSizeForPointSize } from "./tsl";

export interface BustShell {
  sprite: Sprite;
  dispose(): void;
}

/**
 * Phase 10.2 (Ali) — the bust's glowing edge mist. `bust.shell.count` soft sprites (the shared
 * Phase 10 disc) sampled over the bust mesh and pushed just off its skin (gen/shell.ts), drawn
 * with the contour shader's own fresnel: alpha = alphaMin + alphaRim·(1 − max(n·v, 0))^
 * `contours.fresnelPower`, so the cloud is bright where the surface turns away from the camera —
 * the silhouette reads as particles — and nearly invisible over the face, which stays readable.
 * Phase 11.2 (Ali) makes alphaRim its own number (was the implied 1 − alphaMin): at 80k points of
 * half the size, 0.03 + 0.6·fresnel is a soft mist at the silhouette instead of visible dots.
 * Colour follows the contour shader too: `palette.line`, tinted toward `palette.core` by
 * 1 − smoothstep(0, core.radius, |p − core.center|). Additive, no depth writes, drawn after the
 * opaque bust (renderOrder 1). Static — no per-frame work; the sizes are PointsMaterial units
 * converted once through `spriteSizeForPointSize(particles.sizeScale, fov)` like the landscape.
 *
 * float()/vec3() wrappers reify intermediate nodes for the same reason as ContourMaterial.ts:
 * @types/three 0.185.4 narrows some TSL overloads (mix(vec3, vec3, float), smoothstep) to `never`.
 */
export function createBustShell(geometry: BufferGeometry, cfg: SceneConfig): BustShell {
  const { bust, contours, core, palette, particles } = cfg;
  const s = bust.shell;
  const cloud = sampleShell(geometry, s, mulberry32(s.seed));

  const positions = instancedArray(cloud.positions, "vec3");
  const normals = instancedArray(cloud.normals, "vec3");
  const sizes = instancedArray(cloud.sizes, "float");
  // the bust mesh carries no object transform, so the sampled positions are world space already
  const point = vec3(positions.element(instanceIndex));
  const normal = vec3(normals.element(instanceIndex));

  // the contour shader's rim, per particle
  const viewDir = vec3(cameraPosition.sub(point).normalize());
  const facing = float(normal.normalize().dot(viewDir)).max(0);
  const fres = float(oneMinus(facing)).pow(float(contours.fresnelPower));

  // ...and its warm core falloff (no pulse: the shell is the silhouette, not the glow)
  const coreDist = float(distance(point, vec3(...core.center)));
  const coreFall = float(oneMinus(smoothstep(float(0), float(core.radius), coreDist)));

  const material = new SpriteNodeMaterial();
  material.positionNode = point;
  material.scaleNode = float(spriteSizeForPointSize(particles.sizeScale, currentVerticalFov())).mul(
    sizes.element(instanceIndex),
  );
  material.colorNode = vec4(
    vec3(mix(colorVec3(palette.line), colorVec3(palette.core), coreFall)),
    1,
  );
  material.opacityNode = softDisc()
    .mul(float(s.alphaMin).add(float(s.alphaRim).mul(fres)))
    .mul(s.opacity);
  material.transparent = true;
  material.depthTest = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  material.toneMapped = false;

  const sprite = new Sprite(material);
  sprite.count = cloud.count;
  sprite.frustumCulled = false;
  sprite.renderOrder = 1; // after the opaque bust
  return { sprite, dispose: () => material.dispose() };
}
