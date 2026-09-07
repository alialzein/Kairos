import type { Rng } from "@/avatar/sim/random";
import type { SceneConfig } from "../sceneConfig";

export type Noise2D = (x: number, y: number) => number;

export interface LandscapeMesh {
  /** blue nodes, xyz — every node that did not turn gold */
  nodes: Float32Array;
  /** per blue node: PointsMaterial size (uniform in `nodeSize`) */
  nodeSizes: Float32Array;
  /** per blue node: bottom fade 0..1 (smoothstep(fade[0], fade[1], y)) */
  nodeFade: Float32Array;
  /** the `goldRatio` highest-weighted nodes, same layout, sizes × `goldSizeFactor` */
  goldNodes: Float32Array;
  goldNodeSizes: Float32Array;
  goldNodeFade: Float32Array;
  /** unconnected surface dust: `dust.count` per side near the surface, xyz */
  dust: Float32Array;
  dustFade: Float32Array;
  /** edges as segment pairs [ax ay az bx by bz, ...], minus the gold ones */
  blue: Float32Array;
  /** per blue segment endpoint: bottom fade, [fa fb, ...] */
  blueFade: Float32Array;
  /** edges with two gold endpoints, same layout */
  gold: Float32Array;
  goldFade: Float32Array;
  /** blue nodes (the remainder); goldNodeCount = round(goldRatio · all nodes) */
  nodeCount: number;
  goldNodeCount: number;
  dustCount: number;
  blueCount: number;
  goldCount: number;
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Terrain plexus networks flanking the bust (docs/plans/scene-plan.md Phase 7 as a heightfield in
 * Ali's round 3, rebuilt as a node-first network in Phase 10.1). Per side a `cols + 1` × `rows`
 * grid of node seeds (x from xStart to xEnd inclusive, z from zStart stepping back by zStep), each
 * jittered by ±`jitter` in x and z so nothing reads as a grid. Height is two octaves of the seeded
 * noise sampled continuously over the node's own jittered world (x, z) — never per row index — so
 * ridges are broad and coherent and every node sits on the surface:
 *   h = noise2D(x·lowScale, z·lowScale)·lowWeight + noise2D(x·highScale, z·highScale)·highWeight
 *   y = baseY + (zStart − z)·slope + max(h, 0)·amplitude·(0.5 + 0.5·smoothstep(rise[0], rise[1], |x|))
 * so the far rows are the peaks, the near rows drop below the frame, and the ridges keep rising
 * toward the frame edges (Phase 11.1 — replacing round 3's |x| falloff, which flattened the
 * terrain inside |x| = 2.2). The bottom fade smoothstep(fade[0], fade[1], y) on every node is the
 * layer's only fade: the surface fills each side down to the bottom edge of the frame and dies
 * there instead of ending on a line.
 *
 * Phase 10.1 (Ali): nodes are the hero, edges are hints. Each node joins its k nearest neighbours
 * on the same side, k drawn per node from `neighbors` inclusive, skipping candidates farther than
 * `maxEdge` — undirected pairs deduplicated, so long edges cannot exist and the grid-neighbour
 * rule and its dropout are gone. `goldRatio` of the nodes are drawn (without replacement, same
 * rng) with probability ∝ (normalized height)², so gold scatters over every peak; an edge with two
 * gold endpoints is a gold edge.
 *
 * Phase 11.1 (Ali): the density pass — 6,440 nodes per side instead of 602, so the neighbour
 * search is a uniform grid hash (below) rather than the old O(n²) scan, and `dust.count` points
 * per side sit within `dust.radius` of a node picked uniformly at random (surface dust, not ridge
 * dust). rng order, unchanged and load-bearing for determinism: per node jx, jz, size; then k per
 * node; then the gold walk; then, per dust point, the node pick and its radius/cosθ/φ offset.
 */
export function landscape(l: SceneConfig["landscape"], noise2D: Noise2D, rng: Rng): LandscapeMesh {
  const cols = l.cols + 1;
  const rows = l.rows;
  const perSide = cols * rows;
  const total = 2 * perSide;
  const pos = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const fade = new Float32Array(total);
  const fadeOf = (y: number) => smoothstep(l.fade[0], l.fade[1], y);
  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? -1 : 1;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const jx = (rng() * 2 - 1) * l.jitter;
        const jz = (rng() * 2 - 1) * l.jitter;
        const size = l.nodeSize[0] + rng() * (l.nodeSize[1] - l.nodeSize[0]);
        const x = sign * (l.xStart + (i / l.cols) * (l.xEnd - l.xStart)) + jx;
        const z = l.zStart + j * l.zStep + jz;
        const { ridge: r } = l;
        const h =
          noise2D(x * r.lowScale, z * r.lowScale) * r.lowWeight +
          noise2D(x * r.highScale, z * r.highScale) * r.highWeight;
        // Phase 11.1: half height beside the bust, full height out at the frame edge
        const rise = 0.5 + 0.5 * smoothstep(l.rise[0], l.rise[1], Math.abs(x));
        const y = l.baseY + (l.zStart - z) * l.slope + Math.max(h, 0) * l.amplitude * rise;
        const p = side * perSide + i * rows + j;
        pos[p * 3] = x;
        pos[p * 3 + 1] = y;
        pos[p * 3 + 2] = z;
        sizes[p] = size;
        fade[p] = fadeOf(y);
      }
    }
  }

  // k nearest neighbours on the same side, capped at maxEdge. Phase 11.1: 6,440 nodes per side
  // make the old O(n²) scan 41 M distance tests, so each side's nodes are bucketed into a uniform
  // 3D grid of cell size `maxEdge` — every candidate within maxEdge then lies in one of the 27
  // cells around the node's own cell, and the search is linear in the node count. Cell keys are
  // the same linear function of the cell coordinates for the insert and the probe, so a probe
  // outside the bounding box can only alias onto another bucket (whose nodes the distance test
  // rejects) — it can never miss a real neighbour.
  const ks = new Uint8Array(total);
  for (let p = 0; p < total; p++)
    ks[p] = l.neighbors[0] + Math.floor(rng() * (l.neighbors[1] - l.neighbors[0] + 1));
  const maxEdge2 = l.maxEdge * l.maxEdge;
  const cell = Math.max(l.maxEdge, 1e-6);
  const edges: [number, number][] = [];
  const seen = new Set<number>();
  for (let side = 0; side < 2; side++) {
    const lo = side * perSide;
    const hi = lo + perSide;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let p = lo; p < hi; p++) {
      const x = pos[p * 3] ?? 0;
      const y = pos[p * 3 + 1] ?? 0;
      const z = pos[p * 3 + 2] ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const nY = Math.floor((maxY - minY) / cell) + 1;
    const nZ = Math.floor((maxZ - minZ) / cell) + 1;
    const keyOf = (cx: number, cy: number, cz: number) => (cx * nY + cy) * nZ + cz;
    const buckets = new Map<number, number[]>();
    for (let p = lo; p < hi; p++) {
      const k = keyOf(
        Math.floor(((pos[p * 3] ?? 0) - minX) / cell),
        Math.floor(((pos[p * 3 + 1] ?? 0) - minY) / cell),
        Math.floor(((pos[p * 3 + 2] ?? 0) - minZ) / cell),
      );
      const bucket = buckets.get(k);
      if (bucket) bucket.push(p);
      else buckets.set(k, [p]);
    }
    const near: { b: number; d2: number }[] = [];
    for (let a = lo; a < hi; a++) {
      const ax = pos[a * 3] ?? 0;
      const ay = pos[a * 3 + 1] ?? 0;
      const az = pos[a * 3 + 2] ?? 0;
      const cx = Math.floor((ax - minX) / cell);
      const cy = Math.floor((ay - minY) / cell);
      const cz = Math.floor((az - minZ) / cell);
      near.length = 0;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const bucket = buckets.get(keyOf(cx + dx, cy + dy, cz + dz));
            if (!bucket) continue;
            for (const b of bucket) {
              if (b === a) continue;
              const ex = (pos[b * 3] ?? 0) - ax;
              const ey = (pos[b * 3 + 1] ?? 0) - ay;
              const ez = (pos[b * 3 + 2] ?? 0) - az;
              const d2 = ex * ex + ey * ey + ez * ez;
              if (d2 <= maxEdge2) near.push({ b, d2 });
            }
          }
      // ties broken by index, so the result never depends on the bucket iteration order
      near.sort((u, v) => u.d2 - v.d2 || u.b - v.b);
      for (const { b } of near.slice(0, ks[a])) {
        const k = Math.min(a, b) * total + Math.max(a, b);
        if (seen.has(k)) continue;
        seen.add(k);
        edges.push([a, b]);
      }
    }
  }

  // weighted sampling without replacement: each draw walks the remaining weight mass
  const heights = new Float64Array(total);
  let minH = Infinity;
  let maxH = -Infinity;
  for (let p = 0; p < total; p++) {
    const h = pos[p * 3 + 1] ?? 0;
    heights[p] = h;
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  const span = maxH - minH || 1;
  const weight = new Float64Array(total);
  for (let p = 0; p < total; p++) weight[p] = (((heights[p] ?? 0) - minH) / span) ** 2;
  const goldNodeCount = Math.round(total * l.goldRatio);
  const isGold = new Uint8Array(total);
  let remaining = 0;
  for (let p = 0; p < total; p++) remaining += weight[p] ?? 0;
  for (let r = 0; r < goldNodeCount && remaining > 0; r++) {
    let target = rng() * remaining;
    let pick = -1;
    for (let p = 0; p < total; p++) {
      if (isGold[p]) continue;
      target -= weight[p] ?? 0;
      if (target <= 0) {
        pick = p;
        break;
      }
    }
    if (pick < 0) {
      for (let p = total - 1; p >= 0; p--) {
        if (!isGold[p] && (weight[p] ?? 0) > 0) {
          pick = p;
          break;
        }
      }
    }
    if (pick < 0) break;
    isGold[pick] = 1;
    remaining -= weight[pick] ?? 0;
  }

  const nodeCount = total - goldNodeCount;
  const nodes = new Float32Array(nodeCount * 3);
  const nodeSizes = new Float32Array(nodeCount);
  const nodeFade = new Float32Array(nodeCount);
  const goldNodes = new Float32Array(goldNodeCount * 3);
  const goldNodeSizes = new Float32Array(goldNodeCount);
  const goldNodeFade = new Float32Array(goldNodeCount);
  let bn = 0;
  let gn = 0;
  for (let p = 0; p < total; p++) {
    const gold = isGold[p] === 1;
    const at = gold ? gn++ : bn++;
    const target = gold ? goldNodes : nodes;
    for (let c = 0; c < 3; c++) target[at * 3 + c] = pos[p * 3 + c] ?? 0;
    (gold ? goldNodeSizes : nodeSizes)[at] = (sizes[p] ?? 0) * (gold ? l.goldSizeFactor : 1);
    (gold ? goldNodeFade : nodeFade)[at] = fade[p] ?? 0;
  }

  // an edge is gold only when both of its endpoints are
  const goldEdge = edges.map(([a, b]) => isGold[a] === 1 && isGold[b] === 1);
  const goldCount = goldEdge.filter(Boolean).length;
  const blueCount = edges.length - goldCount;
  const blue = new Float32Array(blueCount * 6);
  const blueFade = new Float32Array(blueCount * 2);
  const gold = new Float32Array(goldCount * 6);
  const goldFade = new Float32Array(goldCount * 2);
  let be = 0;
  let ge = 0;
  edges.forEach(([a, b], k) => {
    const isG = goldEdge[k] === true;
    const target = isG ? gold : blue;
    const targetFade = isG ? goldFade : blueFade;
    const at = isG ? ge++ : be++;
    for (let c = 0; c < 3; c++) {
      target[at * 6 + c] = pos[a * 3 + c] ?? 0;
      target[at * 6 + 3 + c] = pos[b * 3 + c] ?? 0;
    }
    targetFade[at * 2] = fade[a] ?? 0;
    targetFade[at * 2 + 1] = fade[b] ?? 0;
  });

  // dust: per side, a node picked uniformly at random (Phase 11.1 — it is surface dust, so it
  // follows the surface everywhere, not just the ridge tops) plus a uniform offset inside a ball
  // of radius `dust.radius`; it carries that node's fade
  const dustCount = 2 * l.dust.count;
  const dust = new Float32Array(dustCount * 3);
  const dustFade = new Float32Array(dustCount);
  let s = 0;
  for (let side = 0; side < 2; side++) {
    const lo = side * perSide;
    for (let n = 0; n < l.dust.count; n++) {
      const pick = lo + Math.min(perSide - 1, Math.floor(rng() * perSide));
      const radius = l.dust.radius * Math.cbrt(rng());
      const cosT = 2 * rng() - 1;
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
      const phi = 2 * Math.PI * rng();
      dust[s * 3] = (pos[pick * 3] ?? 0) + radius * sinT * Math.cos(phi);
      dust[s * 3 + 1] = (pos[pick * 3 + 1] ?? 0) + radius * sinT * Math.sin(phi);
      dust[s * 3 + 2] = (pos[pick * 3 + 2] ?? 0) + radius * cosT;
      dustFade[s] = fade[pick] ?? 0;
      s++;
    }
  }

  return {
    nodes,
    nodeSizes,
    nodeFade,
    goldNodes,
    goldNodeSizes,
    goldNodeFade,
    dust,
    dustFade,
    blue,
    blueFade,
    gold,
    goldFade,
    nodeCount,
    goldNodeCount,
    dustCount,
    blueCount,
    goldCount,
  };
}
