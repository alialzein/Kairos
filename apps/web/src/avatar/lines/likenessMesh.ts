import type { BustMesh } from "../sim/targets/humanoid";
import { GLASSES } from "../sim/targets/likeness";
import type { Contours } from "./slice";

/** Likeness on the mesh (look v2, L3). The hairstyle lift moves the bust's own vertices so
 *  both the sliced line loops and the sampled particles carry Ali's silhouette; the glasses
 *  become real line loops appended to the contour segments. Pure, deterministic. */

const SCALP_Y = 0.55;
const CROWN_Y = 0.66;
const isScalp = (y: number, z: number): boolean => y > SCALP_Y && (z < 0.18 || y > 0.7);

/** Area-weighted vertex normals (unit). */
function vertexNormals(p: Float32Array, idx: Uint32Array): Float32Array {
  const n = new Float32Array(p.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = (idx[t] ?? 0) * 3,
      b = (idx[t + 1] ?? 0) * 3,
      c = (idx[t + 2] ?? 0) * 3;
    const ux = (p[b] ?? 0) - (p[a] ?? 0),
      uy = (p[b + 1] ?? 0) - (p[a + 1] ?? 0),
      uz = (p[b + 2] ?? 0) - (p[a + 2] ?? 0);
    const vx = (p[c] ?? 0) - (p[a] ?? 0),
      vy = (p[c + 1] ?? 0) - (p[a + 1] ?? 0),
      vz = (p[c + 2] ?? 0) - (p[a + 2] ?? 0);
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      n[v] = (n[v] ?? 0) + nx;
      n[v + 1] = (n[v + 1] ?? 0) + ny;
      n[v + 2] = (n[v + 2] ?? 0) + nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i] ?? 0, n[i + 1] ?? 0, n[i + 2] ?? 0) || 1;
    n[i] = (n[i] ?? 0) / l;
    n[i + 1] = (n[i + 1] ?? 0) / l;
    n[i + 2] = (n[i + 2] ?? 0) / l;
  }
  return n;
}

/** Hair lift for a scalp point (same rules as targets/likeness.ts had): tall on top, swept
 *  up-forward at the front quiff, faded short on the sides. Returns the displacement. */
export function hairLift(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
): [number, number, number] {
  const side = Math.min(1, Math.abs(x) / 0.26);
  const top = Math.max(0, (y - CROWN_Y) / (0.9 - CROWN_Y));
  const quiff = z > 0.1 && y > 0.62 ? Math.max(0, (z - 0.1) / 0.3) : 0;
  const lift = 0.012 + top * 0.055 + quiff * 0.075 - side * 0.01;
  return [nx * lift * 0.6, (ny * 0.4 + 0.6) * lift, (nz * 0.5 + quiff * 0.3) * lift];
}

/** New mesh with the scalp vertices lifted into the hairstyle; everything else untouched. */
export function liftMesh(bust: BustMesh): BustMesh {
  const p = bust.positions;
  const normals = vertexNormals(p, bust.indices);
  const out = new Float32Array(p);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i] ?? 0,
      y = p[i + 1] ?? 0,
      z = p[i + 2] ?? 0;
    if (!isScalp(y, z)) continue;
    const [dx, dy, dz] = hairLift(
      x,
      y,
      z,
      normals[i] ?? 0,
      normals[i + 1] ?? 0,
      normals[i + 2] ?? 0,
    );
    out[i] = x + dx;
    out[i + 1] = y + dy;
    out[i + 2] = z + dz;
  }
  const min: [number, number, number] = [...bust.bounds.min];
  const max: [number, number, number] = [...bust.bounds.max];
  for (let i = 0; i < out.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const v = out[i + k] ?? 0;
      if (v < (min[k] ?? 0)) min[k] = v;
      if (v > (max[k] ?? 0)) max[k] = v;
    }
  return { positions: out, indices: bust.indices, bounds: { min, max } };
}

export interface Polyline {
  /** flat xyz */
  points: Float32Array;
  closed: boolean;
}

/** Rounded-rectangle lens outline (superellipse), closed. */
function lens(side: number, n = 64): Polyline {
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const cos = Math.cos(a),
      sin = Math.sin(a);
    pts[i * 3] = side * GLASSES.cx + Math.sign(cos) * Math.pow(Math.abs(cos), 0.5) * GLASSES.w;
    pts[i * 3 + 1] = GLASSES.cy + Math.sign(sin) * Math.pow(Math.abs(sin), 0.5) * GLASSES.h;
    pts[i * 3 + 2] = GLASSES.z;
  }
  return { points: pts, closed: true };
}

/** Glasses as polylines: two rims, a bridge, two temples running back to the ears. */
export function glassesPolylines(): Polyline[] {
  const inner = (GLASSES.cx - GLASSES.w) * 0.95;
  const bridge = new Float32Array([
    -inner,
    GLASSES.cy + 0.018,
    GLASSES.z + 0.01,
    0,
    GLASSES.cy + 0.026,
    GLASSES.z + 0.012,
    inner,
    GLASSES.cy + 0.018,
    GLASSES.z + 0.01,
  ]);
  const temple = (side: number): Polyline => {
    const n = 10;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      pts[i * 3] = side * ((GLASSES.cx + GLASSES.w) * (1 - t) + 0.29 * t);
      pts[i * 3 + 1] = GLASSES.cy * (1 - t) + 0.43 * t;
      pts[i * 3 + 2] = GLASSES.z * (1 - t) + 0.05 * t;
    }
    return { points: pts, closed: false };
  };
  return [lens(-1), lens(1), { points: bridge, closed: false }, temple(-1), temple(1)];
}

/** Append polylines to a contour set as extra segments (slice attr = -1 marks accessories). */
export function appendPolylines(c: Contours, lines: Polyline[]): Contours {
  let extra = 0;
  for (const l of lines) extra += l.closed ? l.points.length / 3 : l.points.length / 3 - 1;
  const segments = new Float32Array(c.segments.length + extra * 6);
  const segSlice = new Float32Array(c.segSlice.length + extra);
  const segT = new Float32Array(c.segT.length + extra);
  const segX = new Float32Array(c.segX.length + extra);
  segments.set(c.segments);
  segSlice.set(c.segSlice);
  segT.set(c.segT);
  segX.set(c.segX);
  let s = c.segSlice.length;
  for (const l of lines) {
    const m = l.points.length / 3;
    const edges = l.closed ? m : m - 1;
    for (let i = 0; i < edges; i++) {
      const a = i * 3,
        b = ((i + 1) % m) * 3;
      segments[s * 6] = l.points[a] ?? 0;
      segments[s * 6 + 1] = l.points[a + 1] ?? 0;
      segments[s * 6 + 2] = l.points[a + 2] ?? 0;
      segments[s * 6 + 3] = l.points[b] ?? 0;
      segments[s * 6 + 4] = l.points[b + 1] ?? 0;
      segments[s * 6 + 5] = l.points[b + 2] ?? 0;
      segSlice[s] = -1;
      segT[s] = i / edges;
      segX[s] = ((l.points[a] ?? 0) + (l.points[b] ?? 0)) * 0.5;
      s++;
    }
  }
  return { ...c, segments, segSlice, segT, segX };
}
