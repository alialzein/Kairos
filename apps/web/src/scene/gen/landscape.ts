import type { Rng } from "@/avatar/sim/random";
import type { SceneConfig } from "../sceneConfig";

export type Noise2D = (x: number, y: number) => number;

export interface LandscapeMesh {
  /** blue nodes, xyz — every node that did not turn gold */
  nodes: Float32Array;
  /** per blue node: PointsMaterial size (uniform in `nodeSize`, × `crest.sizeFactor` on the crest) */
  nodeSizes: Float32Array;
  /** per blue node: bottom fade 0..1 (smoothstep(fade[0], fade[1], y)) */
  nodeFade: Float32Array;
  /** per blue node: colour multiplier — `crest.brightness` on the crest, 1 elsewhere */
  nodeBrightness: Float32Array;
  /** `crest.goldShare` of the crest nodes, same layout, sizes × `goldSizeFactor` on top */
  goldNodes: Float32Array;
  goldNodeSizes: Float32Array;
  goldNodeFade: Float32Array;
  /** per gold node: always `crest.brightness` — every gold node is a crest node */
  goldNodeBrightness: Float32Array;
  /** unconnected slope dust: `dust.count` per side near the surface, xyz */
  dust: Float32Array;
  dustFade: Float32Array;
  /** per dust point: PointsMaterial size, drawn uniformly in `dust.size` (Phase 13.2) */
  dustSizes: Float32Array;
  /** ridge dust: `crest.dust.count` gold points per side within `crest.dust.radius` of a crest node */
  goldDust: Float32Array;
  goldDustFade: Float32Array;
  /** edges as segment pairs [ax ay az bx by bz, ...], minus the gold ones */
  blue: Float32Array;
  /** per blue segment endpoint: bottom fade, [fa fb, ...] */
  blueFade: Float32Array;
  /** per blue segment endpoint: colour multiplier — `crest.brightness` when both endpoints are
   *  crest nodes, 1 otherwise (both endpoints of one segment always carry the same value) */
  blueBrightness: Float32Array;
  /** edges with two gold endpoints, same layout */
  gold: Float32Array;
  goldFade: Float32Array;
  goldBrightness: Float32Array;
  /** blue nodes (the remainder); goldNodeCount = round(crest.goldShare · crestCount) */
  nodeCount: number;
  goldNodeCount: number;
  /** crest nodes over both sides = 2 · (cols + 1) · round(rows · crest.ratio) */
  crestCount: number;
  dustCount: number;
  goldDustCount: number;
  blueCount: number;
  goldCount: number;
}

/** Phase 13.2: the floor under the height weight, so the lowest nodes still get some dust */
const DUST_HEIGHT_EPSILON = 1e-3;

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
 * rule and its dropout are gone. An edge with two gold endpoints is a gold edge.
 *
 * Phase 11.1 (Ali): the density pass — thousands of nodes per side instead of 602, so the
 * neighbour search is a uniform grid hash (below) rather than the old O(n²) scan, and `dust.count`
 * points per side sit within `dust.radius` of a node picked uniformly at random (surface dust, not
 * ridge dust).
 *
 * Phase 12.2 (Ali): the ridge lines. Per column — one side, one x index, so the `rows` nodes at
 * `side·perSide + i·rows + j` — the top `round(rows · crest.ratio)` nodes by y (ties by index) are
 * *crest* nodes: the skyline of the range. A crest node draws at `crest.sizeFactor`× its own size
 * and carries a colour multiplier of `crest.brightness`; an edge with two crest endpoints carries
 * the same multiplier, in whichever object it lands (a crest edge with a non-gold endpoint is a
 * bright blue line, a gold crest edge a bright gold one). The multiplier is on the COLOUR, never
 * on opacity — the scene buffer is half-float (Phase 12.1), so > 1 reaches bloom's bright pass
 * instead of clipping — which is what turns the ridges into flowing lines over a dimmer slope.
 * Gold is now `crest.goldShare` of the crest nodes drawn uniformly (a partial Fisher–Yates over
 * the crest list), replacing Phase 11.1's height²-weighted walk over every node; all gold
 * therefore sits on the skyline, and its size factor stacks on the crest's. Finally
 * `crest.dust.count` gold points per side sit within `crest.dust.radius` of a crest node.
 *
 * Phase 13.2 (Ali): the slopes become the particle mass. Edges drop to `edgeOpacity` 0.05 (hints
 * under the mass), the grid grows to (230 + 1) × 70 = 16,170 nodes per side, and `dust.count`
 * rises to 15,000 per side with a per-point size drawn uniformly in `dust.size` instead of one
 * shared grain size. The dust anchor is no longer uniform: it is drawn with probability ∝ that
 * node's normalised height (y − minY)/(maxY − minY) over its own side, so the mass gathers under
 * the crests and thins down the slope. A node at minY would then have weight 0 and the lowest row
 * would be strictly empty, so every weight carries `DUST_HEIGHT_EPSILON`; on a flat field (span 0)
 * the epsilon is all there is and the draw degenerates to uniform, which is the intent. Sampling
 * is WITH replacement — prefix sums over the side once, then one binary search per point, O(log n)
 * a draw — so 15,000 points cost nothing next to the neighbour search. Crest gold is untouched.
 *
 * rng order, unchanged in shape and load-bearing for determinism: per node jx, jz, size; then k
 * per node; then the gold draw over the crest list; then, per dust point, the node pick, its
 * radius/cosθ/φ offset and (Phase 13.2) its size; then the same three draws per gold dust point
 * over the crest list.
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

  // k nearest neighbours on the same side, capped at maxEdge. Phase 11.1: thousands of nodes per
  // side make the old O(n²) scan tens of millions of distance tests, so each side's nodes are
  // bucketed into a uniform 3D grid of cell size `maxEdge` — every candidate within maxEdge then
  // lies in one of the 27 cells around the node's own cell, and the search is linear in the node
  // count. Cell keys are the same linear function of the cell coordinates for the insert and the
  // probe, so a probe outside the bounding box can only alias onto another bucket (whose nodes the
  // distance test rejects) — it can never miss a real neighbour.
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

  // Phase 12.2: the crest — per column, the `crestPerCol` highest nodes by y, ties by index. A
  // column's nodes are the contiguous run [side·perSide + i·rows, +rows), so this is one sort of
  // `rows` indices per column and the result never depends on the noise scale or the jitter.
  const crestPerCol = Math.min(rows, Math.max(0, Math.round(rows * l.crest.ratio)));
  const isCrest = new Uint8Array(total);
  const crestBySide: number[][] = [[], []];
  const order: number[] = new Array<number>(rows);
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < cols; i++) {
      const lo = side * perSide + i * rows;
      for (let j = 0; j < rows; j++) order[j] = lo + j;
      order.sort((a, b) => (pos[b * 3 + 1] ?? 0) - (pos[a * 3 + 1] ?? 0) || a - b);
      for (let c = 0; c < crestPerCol; c++) isCrest[order[c] ?? lo] = 1;
    }
    for (let p = side * perSide; p < (side + 1) * perSide; p++)
      if (isCrest[p] === 1) crestBySide[side]?.push(p);
  }
  const crestAll = [...(crestBySide[0] ?? []), ...(crestBySide[1] ?? [])];
  const crestCount = crestAll.length;

  // gold = `goldShare` of the crest, drawn uniformly without replacement (partial Fisher–Yates
  // over the crest list, in index order so the draw is deterministic)
  const goldNodeCount = Math.min(crestCount, Math.round(crestCount * l.crest.goldShare));
  const isGold = new Uint8Array(total);
  const bag = crestAll.slice();
  for (let r = 0; r < goldNodeCount; r++) {
    const swap = r + Math.floor(rng() * (bag.length - r));
    const a = bag[r] ?? 0;
    const b = bag[swap] ?? 0;
    bag[r] = b;
    bag[swap] = a;
    isGold[b] = 1;
  }

  const nodeCount = total - goldNodeCount;
  const nodes = new Float32Array(nodeCount * 3);
  const nodeSizes = new Float32Array(nodeCount);
  const nodeFade = new Float32Array(nodeCount);
  const nodeBrightness = new Float32Array(nodeCount);
  const goldNodes = new Float32Array(goldNodeCount * 3);
  const goldNodeSizes = new Float32Array(goldNodeCount);
  const goldNodeFade = new Float32Array(goldNodeCount);
  const goldNodeBrightness = new Float32Array(goldNodeCount);
  let bn = 0;
  let gn = 0;
  for (let p = 0; p < total; p++) {
    const gold = isGold[p] === 1;
    const crest = isCrest[p] === 1;
    const at = gold ? gn++ : bn++;
    const target = gold ? goldNodes : nodes;
    for (let c = 0; c < 3; c++) target[at * 3 + c] = pos[p * 3 + c] ?? 0;
    (gold ? goldNodeSizes : nodeSizes)[at] =
      (sizes[p] ?? 0) * (crest ? l.crest.sizeFactor : 1) * (gold ? l.goldSizeFactor : 1);
    (gold ? goldNodeFade : nodeFade)[at] = fade[p] ?? 0;
    (gold ? goldNodeBrightness : nodeBrightness)[at] = crest ? l.crest.brightness : 1;
  }

  // an edge is gold only when both of its endpoints are, and bright only when both are crest
  const goldEdge = edges.map(([a, b]) => isGold[a] === 1 && isGold[b] === 1);
  const goldCount = goldEdge.filter(Boolean).length;
  const blueCount = edges.length - goldCount;
  const blue = new Float32Array(blueCount * 6);
  const blueFade = new Float32Array(blueCount * 2);
  const blueBrightness = new Float32Array(blueCount * 2);
  const gold = new Float32Array(goldCount * 6);
  const goldFade = new Float32Array(goldCount * 2);
  const goldBrightness = new Float32Array(goldCount * 2);
  let be = 0;
  let ge = 0;
  edges.forEach(([a, b], k) => {
    const isG = goldEdge[k] === true;
    const target = isG ? gold : blue;
    const targetFade = isG ? goldFade : blueFade;
    const targetBright = isG ? goldBrightness : blueBrightness;
    const at = isG ? ge++ : be++;
    for (let c = 0; c < 3; c++) {
      target[at * 6 + c] = pos[a * 3 + c] ?? 0;
      target[at * 6 + 3 + c] = pos[b * 3 + c] ?? 0;
    }
    targetFade[at * 2] = fade[a] ?? 0;
    targetFade[at * 2 + 1] = fade[b] ?? 0;
    const bright = isCrest[a] === 1 && isCrest[b] === 1 ? l.crest.brightness : 1;
    targetBright[at * 2] = bright;
    targetBright[at * 2 + 1] = bright;
  });

  // Phase 13.2 dust: per side, an anchor node drawn WITH replacement at probability ∝ its
  // normalised height + DUST_HEIGHT_EPSILON (so the mass gathers under the crests without leaving
  // the lowest rows strictly empty, and a flat side falls back to a uniform draw), plus a uniform
  // offset inside a ball of radius `dust.radius`; it carries that anchor's fade and its own size.
  // One prefix-sum pass per side, then a binary search per point — O(log n) a draw.
  const dustCount = 2 * l.dust.count;
  const dust = new Float32Array(dustCount * 3);
  const dustFade = new Float32Array(dustCount);
  const dustSizes = new Float32Array(dustCount);
  let s = 0;
  for (let side = 0; side < 2; side++) {
    const lo = side * perSide;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let p = lo; p < lo + perSide; p++) {
      const y = pos[p * 3 + 1] ?? 0;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const span = maxY - minY;
    const cdf = new Float64Array(perSide);
    let acc = 0;
    for (let n = 0; n < perSide; n++) {
      const y = pos[(lo + n) * 3 + 1] ?? 0;
      acc += (span > 0 ? (y - minY) / span : 1) + DUST_HEIGHT_EPSILON;
      cdf[n] = acc;
    }
    for (let n = 0; n < l.dust.count; n++) {
      // the first prefix sum strictly above u — the standard inverse-CDF draw
      const u = rng() * acc;
      let a = 0;
      let b = perSide - 1;
      while (a < b) {
        const mid = (a + b) >> 1;
        if ((cdf[mid] ?? 0) > u) b = mid;
        else a = mid + 1;
      }
      const pick = lo + a;
      const radius = l.dust.radius * Math.cbrt(rng());
      const cosT = 2 * rng() - 1;
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
      const phi = 2 * Math.PI * rng();
      dust[s * 3] = (pos[pick * 3] ?? 0) + radius * sinT * Math.cos(phi);
      dust[s * 3 + 1] = (pos[pick * 3 + 1] ?? 0) + radius * sinT * Math.sin(phi);
      dust[s * 3 + 2] = (pos[pick * 3 + 2] ?? 0) + radius * cosT;
      dustFade[s] = fade[pick] ?? 0;
      dustSizes[s] = l.dust.size[0] + rng() * (l.dust.size[1] - l.dust.size[0]);
      s++;
    }
  }

  // Phase 12.2 gold dust: the same draw, but over that side's crest nodes and inside the much
  // tighter `crest.dust.radius` — a gold haze that hugs the ridge lines instead of the surface
  const goldDustCount = 2 * l.crest.dust.count;
  const goldDust = new Float32Array(goldDustCount * 3);
  const goldDustFade = new Float32Array(goldDustCount);
  let g = 0;
  for (let side = 0; side < 2; side++) {
    const list = crestBySide[side] ?? [];
    for (let n = 0; n < l.crest.dust.count; n++) {
      if (list.length === 0) break;
      const pick = list[Math.min(list.length - 1, Math.floor(rng() * list.length))] ?? 0;
      const radius = l.crest.dust.radius * Math.cbrt(rng());
      const cosT = 2 * rng() - 1;
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
      const phi = 2 * Math.PI * rng();
      goldDust[g * 3] = (pos[pick * 3] ?? 0) + radius * sinT * Math.cos(phi);
      goldDust[g * 3 + 1] = (pos[pick * 3 + 1] ?? 0) + radius * sinT * Math.sin(phi);
      goldDust[g * 3 + 2] = (pos[pick * 3 + 2] ?? 0) + radius * cosT;
      goldDustFade[g] = fade[pick] ?? 0;
      g++;
    }
  }

  return {
    nodes,
    nodeSizes,
    nodeFade,
    nodeBrightness,
    goldNodes,
    goldNodeSizes,
    goldNodeFade,
    goldNodeBrightness,
    dust,
    dustFade,
    dustSizes,
    goldDust,
    goldDustFade,
    blue,
    blueFade,
    blueBrightness,
    gold,
    goldFade,
    goldBrightness,
    nodeCount,
    goldNodeCount,
    crestCount,
    dustCount,
    goldDustCount,
    blueCount,
    goldCount,
  };
}
