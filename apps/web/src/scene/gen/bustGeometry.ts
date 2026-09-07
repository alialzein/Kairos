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

export interface Cavity {
  /** canonical box of the cavity (|x| symmetric, front half via zMin) */
  yMin: number;
  yMax: number;
  xMin: number;
  xMax: number;
  zMin: number;
  /** vertices with z ≥ sheetZ are the outer sheet (skin + lids), below it the inner sheet */
  sheetZ: number;
  /** how far behind the fitted skin the inner sheet is parked (0 = flush) */
  recess: number;
  /** blend-out width at the box's x/y edges so the patch never steps */
  feather: number;
}

/**
 * Closes a cavity in the skin — the eye slits of the bust mesh (Ali, feedback round 1 Phase 2:
 * the reference has no eyes; the GLB bakes lids with an open slit and an eyeball 0.13 behind
 * them into its single mesh, so there is no node to hide and smoothing cannot close a hole).
 * A quadric z(x, y) is least-squares-fitted to the outer sheet inside the box; the outer sheet
 * is laid onto it (the lid folds vanish) and the inner sheet is pulled forward to `recess`
 * behind it, so the slit becomes a flush patch whose walls are edge-on to the camera. The move
 * is feathered toward the box edges. Pure, in place, canonical units. Returns the number of
 * vertices moved.
 */
export function flattenCavity(positions: Float32Array, c: Cavity): number {
  const n = positions.length / 3;
  const inside: number[] = [];
  const weight: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.abs(positions[i * 3] ?? 0);
    const y = positions[i * 3 + 1] ?? 0;
    const z = positions[i * 3 + 2] ?? 0;
    if (x < c.xMin || x > c.xMax || y < c.yMin || y > c.yMax || z < c.zMin) continue;
    const edge = Math.min(x - c.xMin, c.xMax - x, y - c.yMin, c.yMax - y);
    const w = c.feather > 0 ? Math.min(1, edge / c.feather) : 1;
    if (w <= 0) continue;
    inside.push(i);
    weight.push(w);
  }
  // least squares z = a + b·x + c·y + d·x² + e·xy + f·y² over the outer sheet (|x| used, so the
  // fit is mirror-symmetric and one solve serves both eyes)
  const basis = (x: number, y: number) => [1, x, y, x * x, x * y, y * y];
  const ata = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  const atz = new Array<number>(6).fill(0);
  let outer = 0;
  for (const i of inside) {
    const z = positions[i * 3 + 2] ?? 0;
    if (z < c.sheetZ) continue;
    outer++;
    const b = basis(Math.abs(positions[i * 3] ?? 0), positions[i * 3 + 1] ?? 0);
    for (let r = 0; r < 6; r++) {
      atz[r] = (atz[r] ?? 0) + (b[r] ?? 0) * z;
      for (let q = 0; q < 6; q++) ata[r]![q] = (ata[r]![q] ?? 0) + (b[r] ?? 0) * (b[q] ?? 0);
    }
  }
  if (outer < 6) return 0;
  const coef = solve(ata, atz);
  if (!coef) return 0;
  let moved = 0;
  inside.forEach((i, k) => {
    const x = Math.abs(positions[i * 3] ?? 0);
    const y = positions[i * 3 + 1] ?? 0;
    const z = positions[i * 3 + 2] ?? 0;
    const b = basis(x, y);
    let fit = 0;
    for (let r = 0; r < 6; r++) fit += (coef[r] ?? 0) * (b[r] ?? 0);
    const target = z >= c.sheetZ ? fit : fit - c.recess;
    const w = weight[k] ?? 0;
    positions[i * 3 + 2] = z + (target - z) * w;
    moved++;
  });
  return moved;
}

/** Gaussian elimination with partial pivoting for the small normal-equation system. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] ?? 0]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(m[r]![col] ?? 0) > Math.abs(m[pivot]![col] ?? 0)) pivot = r;
    const pr = m[pivot]!;
    if (Math.abs(pr[col] ?? 0) < 1e-12) return null;
    [m[col], m[pivot]] = [pr, m[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = (m[r]![col] ?? 0) / (m[col]![col] ?? 1);
      for (let q = col; q <= n; q++) m[r]![q] = (m[r]![q] ?? 0) - f * (m[col]![q] ?? 0);
    }
  }
  return m.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
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
    /** cavities to close before scaling (the baked-in eye slits) */
    cavities?: readonly Cavity[];
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
  for (const cavity of transform.cavities ?? []) {
    flattenCavity(p.array as Float32Array, cavity);
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
