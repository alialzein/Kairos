import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  Uint32BufferAttribute,
} from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { SceneConfig } from "../sceneConfig";

export type BustParams = SceneConfig["bust"];

/**
 * Procedural bust from primitives (docs/plans/scene-plan.md Phase 2, fallback path): head
 * sphere scaled to an egg, neck cylinder, shoulder ellipsoid, chest box that runs below the
 * frame. One merged geometry; overlaps are fine because the contour shader is per-fragment in
 * world space and the pieces are opaque.
 */
export function primitiveBust(b: BustParams, segments = 96): BufferGeometry {
  const head = new SphereGeometry(b.headRadius, segments, segments);
  head.scale(1, b.headScaleY, 1);
  head.translate(...b.headCenter);

  const neckHeight = b.neckTop - b.neckBottom;
  const neck = new CylinderGeometry(b.neckRadius, b.neckRadius * 1.15, neckHeight, 48, 1);
  neck.translate(0, (b.neckTop + b.neckBottom) / 2, 0);

  const shoulders = new SphereGeometry(1, segments, segments / 2);
  shoulders.scale(...b.shoulderRadii);
  shoulders.translate(...b.shoulderCenter);

  const chest = new BoxGeometry(...b.chestSize);
  chest.translate(...b.chestCenter);

  const parts = [head, neck, shoulders, chest];
  // mergeGeometries needs identical attribute sets; keep position + normal only
  for (const g of parts) g.deleteAttribute("uv");
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  if (!merged) throw new Error("primitiveBust: merge failed");
  return merged;
}

export interface ArmCropZone {
  /** boundary vertices with |x| above this (canonical units) belong to the arm crop */
  xMin: number;
  /** ...and with y in [yMin, yMax] (excludes the bottom crop at y = −0.9) */
  yMin: number;
  yMax: number;
}

/** Vertex indices that lie on an open edge (an edge used by exactly one triangle). */
export function boundaryVertices(index: ArrayLike<number>, vertexCount: number): Uint8Array {
  const count = new Map<number, number>();
  const key = (a: number, b: number) => (a < b ? a * vertexCount + b : b * vertexCount + a);
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = index[t] ?? 0;
    const b = index[t + 1] ?? 0;
    const c = index[t + 2] ?? 0;
    for (const k of [key(a, b), key(b, c), key(c, a)]) count.set(k, (count.get(k) ?? 0) + 1);
  }
  const out = new Uint8Array(vertexCount);
  for (const [k, n] of count) {
    if (n !== 1) continue;
    out[Math.floor(k / vertexCount)] = 1;
    out[k % vertexCount] = 1;
  }
  return out;
}

/**
 * The bust mesh's upper arms were cropped by whole triangles, so each side ends in a jagged
 * boundary loop. This pulls every boundary vertex in the arm zone onto one straight line per side
 * — from the loop's widest point near its top to its widest point near its bottom — so the
 * silhouette reads as a clean deltoid slope. Pure, in place, canonical units.
 */
export function straightenArmCrops(
  positions: Float32Array,
  indices: ArrayLike<number>,
  zone: ArmCropZone,
): void {
  const n = positions.length / 3;
  const onBoundary = boundaryVertices(indices, n);
  for (const side of [-1, 1]) {
    const loop: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = (positions[i * 3] ?? 0) * side;
      const y = positions[i * 3 + 1] ?? 0;
      if (onBoundary[i] && x > zone.xMin && y >= zone.yMin && y <= zone.yMax) loop.push(i);
    }
    if (loop.length < 2) continue;
    let yTop = -Infinity;
    let yBot = Infinity;
    for (const i of loop) {
      const y = positions[i * 3 + 1] ?? 0;
      yTop = Math.max(yTop, y);
      yBot = Math.min(yBot, y);
    }
    const band = Math.max(0.05, (yTop - yBot) * 0.15);
    let xTop = 0;
    let xBot = 0;
    for (const i of loop) {
      const x = Math.abs(positions[i * 3] ?? 0);
      const y = positions[i * 3 + 1] ?? 0;
      if (y >= yTop - band) xTop = Math.max(xTop, x);
      if (y <= yBot + band) xBot = Math.max(xBot, x);
    }
    const span = yTop - yBot || 1;
    for (const i of loop) {
      const y = positions[i * 3 + 1] ?? 0;
      const t = (yTop - y) / span;
      positions[i * 3] = side * (xTop + (xBot - xTop) * t);
    }
  }
}

/**
 * Smooth-shaded geometry from a raw triangle soup (the repo's bust.glb via `loadBust`): welds
 * split vertices so `computeVertexNormals` yields smooth normals for the fresnel rim, then
 * scales/offsets the canonical bust space (y ∈ [−0.9, 0.9]) into scene units.
 */
export function meshBust(
  positions: Float32Array,
  indices: Uint32Array,
  transform: {
    scale: number;
    offset: readonly [number, number, number];
    /** straighten the jagged arm-crop boundaries (see `straightenArmCrops`) */
    armCrop?: ArmCropZone;
    /** canonical y below which vertices are dragged down to `skirtTo`, pulling the bottom crop
     *  below the frame as straight walls */
    skirtBelow?: number;
    skirtTo?: number;
  },
): BufferGeometry {
  const raw = new BufferGeometry();
  raw.setAttribute("position", new Float32BufferAttribute(positions, 3));
  raw.setIndex(new Uint32BufferAttribute(indices, 1));
  const g = mergeVertices(raw, 1e-4);
  raw.dispose();
  const p = g.getAttribute("position");
  if (transform.armCrop) {
    straightenArmCrops(p.array as Float32Array, g.getIndex()?.array ?? [], transform.armCrop);
    p.needsUpdate = true;
  }
  if (transform.skirtBelow !== undefined && transform.skirtTo !== undefined) {
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < transform.skirtBelow) p.setY(i, transform.skirtTo);
    }
    p.needsUpdate = true;
  }
  g.scale(transform.scale, transform.scale, transform.scale);
  g.translate(...transform.offset);
  g.computeVertexNormals();
  return g;
}
