import { cameraPosition, float, normalWorld, oneMinus, positionWorld, vec3 } from "three/tsl";
import {
  AdditiveBlending,
  BackSide,
  Mesh,
  MeshBasicNodeMaterial,
  Vector3,
  type BufferGeometry,
} from "three/webgpu";
import type { SceneConfig } from "./sceneConfig";
import { colorVec3 } from "./tsl";

export interface BustHalo {
  mesh: Mesh;
  dispose(): void;
}

/**
 * Phase 12.3 (Ali) — the silhouette halo. The bust geometry drawn a second time, slightly larger
 * and back faces only, additive with no depth writes, so the only place the copy is visible is
 * where it pokes out past the real bust: a soft glow hugging the outline, and the outline becomes
 * the brightest element in the frame.
 *
 * The fresnel uses `abs(n·v)`, not the contour shader's `max(n·v, 0)`: this material renders back
 * faces, whose geometric normals point away from the camera, so `max(n·v, 0)` would clamp to 0
 * over the whole surface and give a flat `alpha` everywhere. `abs` keeps the same meaning as the
 * front-face rim — 1 where the surface faces the camera (front or back), 0 where it is edge-on —
 * so pow(1 − |n·v|, fresnelPower) is bright exactly at the silhouette.
 *
 * Scale: the bust sits at the world origin with the head around y 1.45 and the geometry running
 * down to y ≈ −3, so `scale.setScalar(1.015)` about the origin would push the crown up ~0.02 and
 * splay the bottom far more than the top. Instead the copy is scaled about the geometry's
 * bounding-box centre — `position = centre·(1 − scale)` with the same uniform scale is exactly
 * that transform — so it grows evenly in every direction.
 *
 * Geometry is SHARED with the bust mesh (never copied) and therefore never disposed here; the
 * material is ours. Drawn at renderOrder 2, after the opaque bust (0) and the shell (1).
 *
 * float()/vec3() wrappers reify intermediate nodes as ContourMaterial.ts does: @types/three
 * 0.185.4 narrows some TSL overloads to `never`.
 */
export function createBustHalo(geometry: BufferGeometry, cfg: SceneConfig): BustHalo {
  const { halo } = cfg.bust;

  const viewDir = vec3(cameraPosition.sub(positionWorld).normalize());
  // abs, not max(·, 0) — see the note above: these are back faces
  const facing = float(vec3(normalWorld).normalize().dot(viewDir)).abs();
  const fres = float(oneMinus(facing)).pow(float(halo.fresnelPower));

  const material = new MeshBasicNodeMaterial();
  material.colorNode = colorVec3(halo.color);
  material.opacityNode = fres.mul(float(halo.alpha));
  material.side = BackSide;
  material.transparent = true;
  material.depthTest = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  material.toneMapped = false;
  material.fog = false;

  const mesh = new Mesh(geometry, material);
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const centre = geometry.boundingBox?.getCenter(new Vector3()) ?? new Vector3();
  mesh.position.copy(centre).multiplyScalar(1 - halo.scale);
  mesh.scale.setScalar(halo.scale);
  mesh.renderOrder = 2; // after the opaque bust and the Phase 10.2 shell (renderOrder 1)
  return { mesh, dispose: () => material.dispose() };
}
