import type { Rng } from "./random";

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export function boundsOf(p: Float32Array): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = p[i + k] ?? 0;
      if (v < (min[k] ?? 0)) min[k] = v;
      if (v > (max[k] ?? 0)) max[k] = v;
    }
  }
  return { min, max };
}

/** Area-weighted surface sampling with barycentric coordinates and jitter along the face normal. */
export function sampleSurface(
  positions: Float32Array,
  indices: Uint32Array,
  n: number,
  rng: Rng,
  jitter = 0.01,
): Float32Array {
  const triCount = indices.length / 3;
  const cum = new Float64Array(triCount);
  const normals = new Float32Array(triCount * 3);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    const a = (indices[t * 3] ?? 0) * 3,
      b = (indices[t * 3 + 1] ?? 0) * 3,
      c = (indices[t * 3 + 2] ?? 0) * 3;
    const ux = (positions[b] ?? 0) - (positions[a] ?? 0),
      uy = (positions[b + 1] ?? 0) - (positions[a + 1] ?? 0),
      uz = (positions[b + 2] ?? 0) - (positions[a + 2] ?? 0);
    const vx = (positions[c] ?? 0) - (positions[a] ?? 0),
      vy = (positions[c + 1] ?? 0) - (positions[a + 1] ?? 0),
      vz = (positions[c + 2] ?? 0) - (positions[a + 2] ?? 0);
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    total += len / 2;
    cum[t] = total;
    if (len > 0) {
      normals[t * 3] = nx / len;
      normals[t * 3 + 1] = ny / len;
      normals[t * 3 + 2] = nz / len;
    }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rng() * total;
    let lo = 0,
      hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cum[mid] ?? 0) < r) lo = mid + 1;
      else hi = mid;
    }
    const t = lo;
    const a = (indices[t * 3] ?? 0) * 3,
      b = (indices[t * 3 + 1] ?? 0) * 3,
      c = (indices[t * 3 + 2] ?? 0) * 3;
    let u = rng(),
      v = rng();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    const j = (rng() * 2 - 1) * jitter;
    out[i * 3] =
      w * (positions[a] ?? 0) +
      u * (positions[b] ?? 0) +
      v * (positions[c] ?? 0) +
      (normals[t * 3] ?? 0) * j;
    out[i * 3 + 1] =
      w * (positions[a + 1] ?? 0) +
      u * (positions[b + 1] ?? 0) +
      v * (positions[c + 1] ?? 0) +
      (normals[t * 3 + 1] ?? 0) * j;
    out[i * 3 + 2] =
      w * (positions[a + 2] ?? 0) +
      u * (positions[b + 2] ?? 0) +
      v * (positions[c + 2] ?? 0) +
      (normals[t * 3 + 2] ?? 0) * j;
  }
  return out;
}

export const Region = { HEAD: 0, FACE: 1, NECK: 2, CHEST: 3, SHOULDERS: 4 } as const;
export type RegionId = (typeof Region)[keyof typeof Region];

/** Height bands of the canonical bust: head > 0.62, neck 0.50–0.62, below: shoulders when |x| > 45 % of half-width. */
export function regionsFor(points: Float32Array, bounds: Bounds): Uint8Array {
  const h = bounds.max[1] - bounds.min[1];
  const halfW = (bounds.max[0] - bounds.min[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  const out = new Uint8Array(points.length / 3);
  for (let i = 0; i < out.length; i++) {
    const x = points[i * 3] ?? 0,
      y = points[i * 3 + 1] ?? 0,
      z = points[i * 3 + 2] ?? 0;
    const yN = (y - bounds.min[1]) / h;
    if (yN > 0.62) out[i] = z > cz + 0.08 ? Region.FACE : Region.HEAD;
    else if (yN > 0.5) out[i] = Region.NECK;
    else out[i] = Math.abs(x) > halfW * 0.45 ? Region.SHOULDERS : Region.CHEST;
  }
  return out;
}
