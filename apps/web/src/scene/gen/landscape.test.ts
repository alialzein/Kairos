import { describe, expect, it } from "vitest";
import { makeNoise } from "@/avatar/sim/noise";
import { mulberry32 } from "@/avatar/sim/random";
import { sceneConfig } from "../sceneConfig";
import { landscape } from "./landscape";

const cfg = sceneConfig.landscape;
const n3 = makeNoise(1);
const noise2D = (x: number, y: number) => n3(x, y, 0);

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const xyz = (a: Float32Array, i: number): [number, number, number] => [
  a[i * 3] ?? 0,
  a[i * 3 + 1] ?? 0,
  a[i * 3 + 2] ?? 0,
];
const key = (p: [number, number, number]) => p.join(",");

describe("landscape (Phase 10.1: a plexus network)", () => {
  const m = landscape(cfg, noise2D, mulberry32(2));
  const perSide = (cfg.cols + 1) * cfg.rows;
  const total = 2 * perSide;
  const goldExpected = Math.round(total * cfg.goldRatio);
  const zFar = cfg.zStart + (cfg.rows - 1) * cfg.zStep;
  // every node, blue then gold, as one list — the split is only a draw-call split
  const all: [number, number, number][] = [];
  for (let i = 0; i < m.nodeCount; i++) all.push(xyz(m.nodes, i));
  for (let i = 0; i < m.goldNodeCount; i++) all.push(xyz(m.goldNodes, i));
  const indexOf = new Map(all.map((p, i) => [key(p), i]));

  it("places 2 × (cols + 1) × rows jittered nodes, split into a blue remainder and goldRatio gold", () => {
    // gold count = round(goldRatio · total nodes); nodeCount is the blue remainder
    expect(m.goldNodeCount).toBe(goldExpected);
    expect(m.nodeCount).toBe(total - goldExpected);
    expect(m.nodes.length).toBe(m.nodeCount * 3);
    expect(m.nodeSizes.length).toBe(m.nodeCount);
    expect(m.nodeFade.length).toBe(m.nodeCount);
    expect(m.goldNodes.length).toBe(m.goldNodeCount * 3);
    expect(m.goldNodeSizes.length).toBe(m.goldNodeCount);
    expect(m.goldNodeFade.length).toBe(m.goldNodeCount);
    expect(all.length).toBe(total);
    // no two nodes land on the same spot (so the coordinate → index map below is sound)
    expect(indexOf.size).toBe(total);
  });

  it("keeps every node inside the grid widened by the jitter, on the heightfield", () => {
    const { ridge: r, jitter: j } = cfg;
    for (const [x, y, z] of all) {
      expect(Math.abs(x)).toBeGreaterThanOrEqual(cfg.xStart - j - 1e-6);
      expect(Math.abs(x)).toBeLessThanOrEqual(cfg.xEnd + j + 1e-6);
      expect(z).toBeLessThanOrEqual(cfg.zStart + j + 1e-6);
      expect(z).toBeGreaterThanOrEqual(zFar - j - 1e-6);
      expect(y).toBeGreaterThanOrEqual(cfg.baseY - j * cfg.slope - 1e-6);
      expect(y).toBeLessThanOrEqual(
        cfg.baseY + (cfg.zStart - zFar + j) * cfg.slope + cfg.amplitude + 1e-6,
      );
      // y = baseY + (zStart − z)·slope + max(h, 0)·amplitude·falloff, the noise sampled at the
      // node's own jittered (x, z) — so the node sits on the surface, not above its grid cell
      const h =
        noise2D(x * r.lowScale, z * r.lowScale) * r.lowWeight +
        noise2D(x * r.highScale, z * r.highScale) * r.highWeight;
      const falloff = smoothstep(cfg.falloff[0], cfg.falloff[1], Math.abs(x));
      expect(y).toBeCloseTo(
        cfg.baseY + (cfg.zStart - z) * cfg.slope + Math.max(h, 0) * cfg.amplitude * falloff,
        5,
      );
    }
    // the slope: the whole field still rises toward the back
    const back = all.filter(([, , z]) => z < (cfg.zStart + zFar) / 2);
    const front = all.filter(([, , z]) => z >= (cfg.zStart + zFar) / 2);
    const meanY = (ps: [number, number, number][]) => ps.reduce((s, p) => s + p[1], 0) / ps.length;
    expect(meanY(back)).toBeGreaterThan(meanY(front) + 0.5);
  });

  it("sizes nodes uniformly in nodeSize, gold at goldSizeFactor× that range", () => {
    for (let i = 0; i < m.nodeCount; i++) {
      expect(m.nodeSizes[i]).toBeGreaterThanOrEqual(cfg.nodeSize[0]);
      expect(m.nodeSizes[i]).toBeLessThanOrEqual(cfg.nodeSize[1]);
    }
    for (let i = 0; i < m.goldNodeCount; i++) {
      expect(m.goldNodeSizes[i]).toBeGreaterThanOrEqual(
        cfg.nodeSize[0] * cfg.goldSizeFactor - 1e-6,
      );
      expect(m.goldNodeSizes[i]).toBeLessThanOrEqual(cfg.nodeSize[1] * cfg.goldSizeFactor + 1e-6);
    }
    // not all one value: the sizes really vary
    expect(new Set(Array.from(m.nodeSizes)).size).toBeGreaterThan(100);
  });

  it("fades out at the bottom: smoothstep(fade[0], fade[1], y) per node, sprinkle and endpoint", () => {
    for (let i = 0; i < m.nodeCount; i++)
      expect(m.nodeFade[i]).toBeCloseTo(smoothstep(cfg.fade[0], cfg.fade[1], all[i]?.[1] ?? 0), 6);
    for (let i = 0; i < m.goldNodeCount; i++)
      expect(m.goldNodeFade[i]).toBeCloseTo(
        smoothstep(cfg.fade[0], cfg.fade[1], all[m.nodeCount + i]?.[1] ?? 0),
        6,
      );
    expect(m.blueFade.length).toBe(m.blueCount * 2);
    expect(m.goldFade.length).toBe(m.goldCount * 2);
    for (let k = 0; k < m.blueCount; k++)
      for (const e of [0, 1])
        expect(m.blueFade[k * 2 + e]).toBeCloseTo(
          smoothstep(cfg.fade[0], cfg.fade[1], m.blue[k * 6 + e * 3 + 1] ?? 0),
          6,
        );
  });

  it("joins each node to its k ∈ neighbors nearest same-side neighbours, never farther than maxEdge", () => {
    expect(m.blue.length).toBe(m.blueCount * 6);
    expect(m.gold.length).toBe(m.goldCount * 6);
    const edges: [number, number][] = [];
    const seen = new Set<string>();
    const walk = (a: Float32Array, n: number) => {
      for (let k = 0; k < n; k++) {
        const p: [number, number, number] = [a[k * 6] ?? 0, a[k * 6 + 1] ?? 0, a[k * 6 + 2] ?? 0];
        const q: [number, number, number] = [
          a[k * 6 + 3] ?? 0,
          a[k * 6 + 4] ?? 0,
          a[k * 6 + 5] ?? 0,
        ];
        const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        expect(d).toBeLessThanOrEqual(cfg.maxEdge + 1e-6);
        expect(d).toBeGreaterThan(0);
        const i = indexOf.get(key(p));
        const j = indexOf.get(key(q));
        expect(i).toBeDefined();
        expect(j).toBeDefined();
        const pair = `${Math.min(i ?? 0, j ?? 0)}-${Math.max(i ?? 0, j ?? 0)}`;
        expect(seen.has(pair)).toBe(false); // undirected pairs are deduplicated
        seen.add(pair);
        edges.push([i ?? 0, j ?? 0]);
        // both sides of an edge are the same side of the scene
        expect(Math.sign(p[0])).toBe(Math.sign(q[0]));
      }
    };
    walk(m.blue, m.blueCount);
    walk(m.gold, m.goldCount);
    expect(edges.length).toBeGreaterThan(total); // k ≥ 2 per node, deduplicated
    // every node that has a same-side neighbour within maxEdge ends up with at least one edge
    const degree = new Uint16Array(total);
    for (const [i, j] of edges) {
      degree[i] = (degree[i] ?? 0) + 1;
      degree[j] = (degree[j] ?? 0) + 1;
    }
    let connectable = 0;
    let connected = 0;
    for (let i = 0; i < total; i++) {
      const a = all[i] ?? [0, 0, 0];
      const has = all.some(
        (b, j) =>
          j !== i &&
          Math.sign(b[0]) === Math.sign(a[0]) &&
          Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) <= cfg.maxEdge,
      );
      if (!has) continue;
      connectable++;
      if ((degree[i] ?? 0) > 0) connected++;
    }
    expect(connectable).toBeGreaterThan(total * 0.99);
    expect(connected / connectable).toBeGreaterThanOrEqual(0.95);
  });

  it("makes the highest nodes gold, and an edge gold only when both its endpoints are", () => {
    const meanY = (ps: [number, number, number][]) => ps.reduce((s, p) => s + p[1], 0) / ps.length;
    expect(meanY(all.slice(m.nodeCount))).toBeGreaterThan(meanY(all.slice(0, m.nodeCount)) + 0.2);
    const goldSet = new Set(all.slice(m.nodeCount).map(key));
    for (let k = 0; k < m.goldCount; k++) {
      expect(
        goldSet.has(key([m.gold[k * 6] ?? 0, m.gold[k * 6 + 1] ?? 0, m.gold[k * 6 + 2] ?? 0])),
      ).toBe(true);
      expect(
        goldSet.has(key([m.gold[k * 6 + 3] ?? 0, m.gold[k * 6 + 4] ?? 0, m.gold[k * 6 + 5] ?? 0])),
      ).toBe(true);
    }
    // and no blue edge has two gold endpoints
    for (let k = 0; k < m.blueCount; k++) {
      const a = goldSet.has(
        key([m.blue[k * 6] ?? 0, m.blue[k * 6 + 1] ?? 0, m.blue[k * 6 + 2] ?? 0]),
      );
      const b = goldSet.has(
        key([m.blue[k * 6 + 3] ?? 0, m.blue[k * 6 + 4] ?? 0, m.blue[k * 6 + 5] ?? 0]),
      );
      expect(a && b).toBe(false);
    }
    // gold scatters over every peak rather than clumping in one column
    const columns = { left: new Set<number>(), right: new Set<number>() };
    for (const [x] of all.slice(m.nodeCount)) {
      const i = Math.round(((Math.abs(x) - cfg.xStart) / (cfg.xEnd - cfg.xStart)) * cfg.cols);
      (x < 0 ? columns.left : columns.right).add(i);
    }
    expect(columns.left.size).toBeGreaterThan(8);
    expect(columns.right.size).toBeGreaterThan(8);
  });

  it("scatters sprinkle.count tiny points per side inside sprinkle.radius of a node", () => {
    expect(m.sprinkleCount).toBe(2 * cfg.sprinkle.count);
    expect(m.sprinkle.length).toBe(m.sprinkleCount * 3);
    expect(m.sprinkleFade.length).toBe(m.sprinkleCount);
    const r = cfg.sprinkle.radius;
    // each point sits inside sprinkle.radius of a node and carries that node's fade (not its own y)
    const fadeOf = [...Array.from(m.nodeFade), ...Array.from(m.goldNodeFade)];
    for (let i = 0; i < m.sprinkleCount; i++) {
      const p = xyz(m.sprinkle, i);
      const near = all.some(
        (b, j) =>
          Math.hypot(b[0] - p[0], b[1] - p[1], b[2] - p[2]) <= r + 1e-6 &&
          Math.abs((fadeOf[j] ?? -1) - (m.sprinkleFade[i] ?? -2)) < 1e-6,
      );
      expect(near).toBe(true);
    }
    // both sides get points
    expect(m.sprinkle.filter((_, i) => i % 3 === 0).some((x) => x < 0)).toBe(true);
    expect(m.sprinkle.filter((_, i) => i % 3 === 0).some((x) => x > 0)).toBe(true);
  });

  it("is deterministic for a given noise and seed", () => {
    const a = landscape(cfg, noise2D, mulberry32(4));
    const b = landscape(cfg, noise2D, mulberry32(4));
    for (const k of [
      "nodes",
      "nodeSizes",
      "nodeFade",
      "goldNodes",
      "goldNodeSizes",
      "goldNodeFade",
      "sprinkle",
      "sprinkleFade",
      "blue",
      "blueFade",
      "gold",
      "goldFade",
    ] as const) {
      expect(Array.from(a[k])).toEqual(Array.from(b[k]));
    }
  });
});
