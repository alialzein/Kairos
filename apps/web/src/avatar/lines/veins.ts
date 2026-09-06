import type { Rng } from "../sim/random";

/** Energy veins (look v2, L4): deterministic branching polylines. The spine tree runs from the
 *  throat down to a chest node; the node is a six-fold snowflake. Pure; every branch starts on
 *  a vertex of its parent, so the tree is connected by construction. */

export interface VeinTree {
  /** fat-line segment pairs, flat xyz */
  segments: Float32Array;
  /** per segment: path distance from the root, normalised 0..1 over the tree (pulse phase) */
  segT: Float32Array;
  /** per segment: branch generation (0 = trunk) */
  segGen: Float32Array;
  /** polyline start points of every branch except the root (for tests) */
  branchStarts: Float32Array;
}

export const THROAT: readonly [number, number, number] = [0, 0.16, 0.3];
export const CHEST_NODE: readonly [number, number, number] = [0, -0.25, 0.3];
const Z_MIN = 0.28;
const Z_MAX = 0.32;
/** chest snowflake spoke length */
export const NODE_R = 0.14;

interface Branch {
  pts: number[]; // flat xyz
  dist: number[]; // path distance from the root per point
  gen: number;
}

function grow(
  branches: Branch[],
  starts: number[],
  x: number,
  y: number,
  dx: number,
  dy: number,
  len: number,
  gen: number,
  d0: number,
  rng: Rng,
  maxGen: number,
  spawnEvery: number,
): void {
  const steps = Math.max(3, Math.round(len / 0.025));
  const pts: number[] = [];
  const dist: number[] = [];
  let px = x,
    py = y,
    d = d0;
  const norm = Math.hypot(dx, dy) || 1;
  let ux = dx / norm,
    uy = dy / norm;
  for (let i = 0; i <= steps; i++) {
    pts.push(px, py, Z_MIN + rng() * (Z_MAX - Z_MIN));
    dist.push(d);
    if (i === steps) break;
    // jitter the heading a little each step (lightning, not a ruler) and keep pulling back
    // toward the centre line so the tree hugs the spine instead of random-walking sideways
    const turn = (rng() - 0.5) * 0.3;
    let nx = ux * Math.cos(turn) - uy * Math.sin(turn);
    let ny = ux * Math.sin(turn) + uy * Math.cos(turn);
    const pull = Math.min(0.6, Math.abs(px) * 3) * (px > 0 ? -1 : 1);
    nx = nx * (1 - 0.35) + pull * 0.35;
    ny = ny * (1 - 0.35) + -1 * 0.35;
    const nl = Math.hypot(nx, ny) || 1;
    ux = nx / nl;
    uy = ny / nl;
    const step = len / steps;
    px += ux * step;
    py += uy * step;
    d += step;
    // the tree ends at the chest node: clip anything that would run past it
    if (py < CHEST_NODE[1] - 0.015) {
      pts.push(px, CHEST_NODE[1] - 0.015, (Z_MIN + Z_MAX) / 2);
      dist.push(d);
      break;
    }
    if (gen < maxGen && i > 0 && i % spawnEvery === 0) {
      // alternate sides, steer branches back inward when the trunk has drifted
      const side = px > 0.02 ? -1 : px < -0.02 ? 1 : rng() < 0.5 ? -1 : 1;
      const ang = side * (0.4 + rng() * 0.35);
      const bx = ux * Math.cos(ang) - uy * Math.sin(ang);
      const by = ux * Math.sin(ang) + uy * Math.cos(ang);
      starts.push(px, py);
      grow(
        branches,
        starts,
        px,
        py,
        bx,
        by,
        len * (0.42 + rng() * 0.22),
        gen + 1,
        d,
        rng,
        maxGen,
        Math.max(2, spawnEvery - 1),
      );
    }
  }
  branches.push({ pts, dist, gen });
}

function pack(branches: Branch[], starts: number[]): VeinTree {
  let segs = 0;
  let maxD = 0;
  for (const b of branches) {
    segs += b.pts.length / 3 - 1;
    for (const d of b.dist) maxD = Math.max(maxD, d);
  }
  const segments = new Float32Array(segs * 6);
  const segT = new Float32Array(segs);
  const segGen = new Float32Array(segs);
  let s = 0;
  for (const b of branches) {
    const m = b.pts.length / 3;
    for (let i = 0; i < m - 1; i++) {
      for (let k = 0; k < 3; k++) {
        segments[s * 6 + k] = b.pts[i * 3 + k] ?? 0;
        segments[s * 6 + 3 + k] = b.pts[(i + 1) * 3 + k] ?? 0;
      }
      segT[s] = maxD > 0 ? ((b.dist[i] ?? 0) + (b.dist[i + 1] ?? 0)) / 2 / maxD : 0;
      segGen[s] = b.gen;
      s++;
    }
  }
  // branch starts as xyz (z on the vein plane centre) for connectivity tests
  const bs = new Float32Array((starts.length / 2) * 3);
  for (let i = 0; i < starts.length / 2; i++) {
    bs[i * 3] = starts[i * 2] ?? 0;
    bs[i * 3 + 1] = starts[i * 2 + 1] ?? 0;
    bs[i * 3 + 2] = (Z_MIN + Z_MAX) / 2;
  }
  return { segments, segT, segGen, branchStarts: bs };
}

/** Lightning-tree spine: trunk from the throat to the chest node with three generations of
 *  side branches. */
export function spineTree(rng: Rng): VeinTree {
  const branches: Branch[] = [];
  const starts: number[] = [];
  const len = THROAT[1] - CHEST_NODE[1];
  grow(branches, starts, THROAT[0], THROAT[1], 0, -1, len, 0, 0, rng, 3, 3);
  return pack(branches, starts);
}

/** Six-fold snowflake node at the chest: spokes with two sub-branches each. */
export function chestNode(rng: Rng): VeinTree {
  const branches: Branch[] = [];
  const starts: number[] = [];
  const [cx, cy] = CHEST_NODE;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const dx = Math.cos(a),
      dy = Math.sin(a);
    const spoke: Branch = { pts: [], dist: [], gen: 0 };
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      spoke.pts.push(
        cx + dx * NODE_R * t,
        cy + dy * NODE_R * t,
        (Z_MIN + Z_MAX) / 2 + (rng() - 0.5) * 0.01,
      );
      spoke.dist.push(NODE_R * t);
    }
    branches.push(spoke);
    // two sub-branches at 60 % of the spoke, ±35°
    const bx = cx + dx * NODE_R * 0.6,
      by = cy + dy * NODE_R * 0.6;
    for (const side of [-1, 1]) {
      const ang = side * 0.61;
      const sx = dx * Math.cos(ang) - dy * Math.sin(ang);
      const sy = dx * Math.sin(ang) + dy * Math.cos(ang);
      starts.push(bx, by);
      const sub: Branch = { pts: [], dist: [], gen: 1 };
      for (let i = 0; i <= 2; i++) {
        const t = i / 2;
        sub.pts.push(bx + sx * NODE_R * 0.4 * t, by + sy * NODE_R * 0.4 * t, (Z_MIN + Z_MAX) / 2);
        sub.dist.push(NODE_R * 0.6 + NODE_R * 0.4 * t);
      }
      branches.push(sub);
    }
  }
  return pack(branches, starts);
}

/** Concatenate trees into one segment set. */
export function mergeTrees(trees: VeinTree[]): VeinTree {
  const n = trees.reduce((a, t) => a + t.segT.length, 0);
  const segments = new Float32Array(n * 6);
  const segT = new Float32Array(n);
  const segGen = new Float32Array(n);
  const bsLen = trees.reduce((a, t) => a + t.branchStarts.length, 0);
  const branchStarts = new Float32Array(bsLen);
  let s = 0,
    b = 0;
  for (const t of trees) {
    segments.set(t.segments, s * 6);
    segT.set(t.segT, s);
    segGen.set(t.segGen, s);
    branchStarts.set(t.branchStarts, b);
    s += t.segT.length;
    b += t.branchStarts.length;
  }
  return { segments, segT, segGen, branchStarts };
}
