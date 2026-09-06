/** Mesh slicing for the wireframe bust (spec: docs/superpowers/specs/2026-09-06-wireframe-bust-design.md).
 *  Cuts a triangle mesh with N horizontal planes into closed contour loops, resampled to even
 *  spacing, and packs them as fat-line segment pairs plus per-segment attributes. Pure and
 *  deterministic; never throws on a valid (possibly degenerate) mesh. */

export interface SliceOptions {
  /** number of planes between yMin and yMax inclusive */
  count: number;
  yMin: number;
  yMax: number;
  /** target distance between resampled vertices */
  spacing: number;
}

export interface Loop {
  /** first vertex index into `vertices` (xyz triples) */
  start: number;
  count: number;
  /** plane height */
  y: number;
  /** plane index 0..count-1 */
  slice: number;
  /** false for chains that end on a mesh boundary (open back/bottom of the bust) */
  closed: boolean;
}

export interface Contours {
  vertices: Float32Array;
  loops: Loop[];
  /** flat xyz pairs: [ax ay az bx by bz, ...] — one pair per segment, loops closed */
  segments: Float32Array;
  /** per segment: plane index */
  segSlice: Float32Array;
  /** per segment: arc position 0..1 around its loop */
  segT: Float32Array;
  /** per segment: midpoint x (for reveal sweeps) */
  segX: Float32Array;
}

const MIN_LOOP = 8;
const KEY_Q = 1e-4;

const key = (x: number, z: number): string => `${Math.round(x / KEY_Q)},${Math.round(z / KEY_Q)}`;

/** Intersection of edge (i,j) with plane y; vertex order normalised so shared edges agree bitwise. */
function edgeHit(p: Float32Array, i: number, j: number, y: number): [number, number] | null {
  if (j < i) [i, j] = [j, i];
  const ay = p[i * 3 + 1] ?? 0;
  const by = p[j * 3 + 1] ?? 0;
  if ((ay < y && by < y) || (ay >= y && by >= y)) return null;
  const t = (y - ay) / (by - ay);
  return [
    (p[i * 3] ?? 0) + ((p[j * 3] ?? 0) - (p[i * 3] ?? 0)) * t,
    (p[i * 3 + 2] ?? 0) + ((p[j * 3 + 2] ?? 0) - (p[i * 3 + 2] ?? 0)) * t,
  ];
}

/** Segments (xz pairs) where the mesh crosses plane y. */
function planeSegments(p: Float32Array, idx: Uint32Array, y: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] ?? 0,
      b = idx[t + 1] ?? 0,
      c = idx[t + 2] ?? 0;
    const hits: [number, number][] = [];
    const ab = edgeHit(p, a, b, y);
    const bc = edgeHit(p, b, c, y);
    const ca = edgeHit(p, c, a, y);
    if (ab) hits.push(ab);
    if (bc) hits.push(bc);
    if (ca) hits.push(ca);
    if (hits.length === 2) {
      const [h0, h1] = hits as [[number, number], [number, number]];
      out.push(h0[0], h0[1], h1[0], h1[1]);
    }
  }
  return out;
}

interface Chain {
  xz: number[];
  closed: boolean;
}

/** Chain segments into loops (xz pairs). Closed loops wrap; open chains (mesh boundary) are
 *  kept as polylines so the torso still draws where the bust shell is open. */
function chainLoops(segs: number[]): Chain[] {
  const n = segs.length / 4;
  const byKey = new Map<string, number[]>();
  for (let s = 0; s < n; s++) {
    for (const end of [0, 2]) {
      const k = key(segs[s * 4 + end] ?? 0, segs[s * 4 + end + 1] ?? 0);
      const list = byKey.get(k);
      if (list) list.push(s);
      else byKey.set(k, [s]);
    }
  }
  const used = new Uint8Array(n);
  const degree = (k: string): number => (byKey.get(k) ?? []).length;
  const walk = (s0: number, startEnd: 0 | 2): { xz: number[]; closed: boolean } => {
    const xz: number[] = [];
    let s = s0;
    let cx = segs[s * 4 + startEnd] ?? 0,
      cz = segs[s * 4 + startEnd + 1] ?? 0;
    const startKey = key(cx, cz);
    let closed = false;
    for (let guard = 0; guard <= n; guard++) {
      used[s] = 1;
      // orient: leave from the end that matches (cx,cz)
      const k0 = key(segs[s * 4] ?? 0, segs[s * 4 + 1] ?? 0);
      const outIdx = k0 === key(cx, cz) ? 2 : 0;
      xz.push(cx, cz);
      cx = segs[s * 4 + outIdx] ?? 0;
      cz = segs[s * 4 + outIdx + 1] ?? 0;
      const k = key(cx, cz);
      if (k === startKey) {
        closed = true;
        break;
      }
      const next = (byKey.get(k) ?? []).find((c) => !used[c]);
      if (next === undefined) {
        xz.push(cx, cz); // open chain keeps its final endpoint
        break;
      }
      s = next;
    }
    return { xz, closed };
  };
  const chains: Chain[] = [];
  // open chains first, started from a boundary endpoint (degree 1) so they are walked whole
  for (let s0 = 0; s0 < n; s0++) {
    if (used[s0]) continue;
    const kA = key(segs[s0 * 4] ?? 0, segs[s0 * 4 + 1] ?? 0);
    const kB = key(segs[s0 * 4 + 2] ?? 0, segs[s0 * 4 + 3] ?? 0);
    if (degree(kA) === 1) chains.push(walk(s0, 0));
    else if (degree(kB) === 1) chains.push(walk(s0, 2));
  }
  for (let s0 = 0; s0 < n; s0++) {
    if (used[s0]) continue;
    chains.push(walk(s0, 0));
  }
  return chains.filter((c) => c.xz.length / 2 >= 3);
}

/** Resample an xz polyline (closed: wraps) to even spacing; returns xz pairs. */
function resample(loop: number[], spacing: number, closed: boolean): number[] {
  const m = loop.length / 2;
  let len = 0;
  const cum: number[] = [0];
  const edges = closed ? m : m - 1;
  for (let i = 0; i < edges; i++) {
    const j = (i + 1) % m;
    len += Math.hypot(
      (loop[j * 2] ?? 0) - (loop[i * 2] ?? 0),
      (loop[j * 2 + 1] ?? 0) - (loop[i * 2 + 1] ?? 0),
    );
    cum.push(len);
  }
  if (len === 0) return [];
  const count = Math.max(MIN_LOOP, Math.round(len / spacing));
  const step = closed ? len / count : len / (count - 1);
  const out: number[] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const d = Math.min(len, k * step);
    while (seg < edges - 1 && (cum[seg + 1] ?? 0) < d) seg++;
    const j = (seg + 1) % m;
    const segLen = (cum[seg + 1] ?? 0) - (cum[seg] ?? 0) || 1;
    const t = (d - (cum[seg] ?? 0)) / segLen;
    out.push(
      (loop[seg * 2] ?? 0) + ((loop[j * 2] ?? 0) - (loop[seg * 2] ?? 0)) * t,
      (loop[seg * 2 + 1] ?? 0) + ((loop[j * 2 + 1] ?? 0) - (loop[seg * 2 + 1] ?? 0)) * t,
    );
  }
  return out;
}

export function sliceMesh(
  positions: Float32Array,
  indices: Uint32Array,
  opts: SliceOptions,
): Contours {
  const verts: number[] = [];
  const loops: Loop[] = [];
  const planes = Math.max(1, opts.count);
  for (let k = 0; k < planes; k++) {
    // nudge planes off exact vertex heights so a vertex is never "on" the plane
    const y = opts.yMin + ((opts.yMax - opts.yMin) * k) / Math.max(1, planes - 1) + 1e-6;
    const segs = planeSegments(positions, indices, y);
    for (const raw of chainLoops(segs)) {
      const xz = resample(raw.xz, opts.spacing, raw.closed);
      const count = xz.length / 2;
      if (count < MIN_LOOP) continue;
      loops.push({ start: verts.length / 3, count, y, slice: k, closed: raw.closed });
      for (let i = 0; i < count; i++) verts.push(xz[i * 2] ?? 0, y, xz[i * 2 + 1] ?? 0);
    }
  }
  const vertices = Float32Array.from(verts);
  let segCount = 0;
  for (const l of loops) segCount += l.closed ? l.count : l.count - 1;
  const segments = new Float32Array(segCount * 6);
  const segSlice = new Float32Array(segCount);
  const segT = new Float32Array(segCount);
  const segX = new Float32Array(segCount);
  let s = 0;
  for (const l of loops) {
    const edges = l.closed ? l.count : l.count - 1;
    for (let i = 0; i < edges; i++) {
      const a = (l.start + i) * 3;
      const b = (l.start + ((i + 1) % l.count)) * 3;
      segments[s * 6] = vertices[a] ?? 0;
      segments[s * 6 + 1] = vertices[a + 1] ?? 0;
      segments[s * 6 + 2] = vertices[a + 2] ?? 0;
      segments[s * 6 + 3] = vertices[b] ?? 0;
      segments[s * 6 + 4] = vertices[b + 1] ?? 0;
      segments[s * 6 + 5] = vertices[b + 2] ?? 0;
      segSlice[s] = l.slice;
      segT[s] = i / l.count;
      segX[s] = ((vertices[a] ?? 0) + (vertices[b] ?? 0)) * 0.5;
      s++;
    }
  }
  return { vertices, loops, segments, segSlice, segT, segX };
}
