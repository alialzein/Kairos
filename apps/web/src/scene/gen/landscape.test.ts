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
const meanY = (ps: [number, number, number][]) => ps.reduce((s, p) => s + p[1], 0) / ps.length;

// Phase 11.1 (Ali): the shipped grid is (160 + 1) × 40 = 6,440 nodes per side. The per-node
// assertions below are O(n²) (nearest-neighbour reachability, dust containment), so they run on a
// reduced 61 × 12 grid with 400 dust per side; the shipped config is covered by the counts, the
// uniform dust pick and the generation-time guard in the last test.
const small: typeof cfg = { ...cfg, cols: 60, rows: 12, dust: { ...cfg.dust, count: 400 } };

describe("landscape (Phase 11.1: a dense plexus network)", () => {
  const m = landscape(small, noise2D, mulberry32(2));
  const perSide = (small.cols + 1) * small.rows;
  const total = 2 * perSide;
  const goldExpected = Math.round(total * small.goldRatio);
  const zFar = small.zStart + (small.rows - 1) * small.zStep;
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

  it("lifts every node onto the heightfield, the ridges rising toward the frame edges", () => {
    const { ridge: r, jitter: j } = small;
    for (const [x, y, z] of all) {
      expect(Math.abs(x)).toBeGreaterThanOrEqual(small.xStart - j - 1e-6);
      expect(Math.abs(x)).toBeLessThanOrEqual(small.xEnd + j + 1e-6);
      expect(z).toBeLessThanOrEqual(small.zStart + j + 1e-6);
      expect(z).toBeGreaterThanOrEqual(zFar - j - 1e-6);
      expect(y).toBeGreaterThanOrEqual(small.baseY - j * small.slope - 1e-6);
      expect(y).toBeLessThanOrEqual(
        small.baseY + (small.zStart - zFar + j) * small.slope + small.amplitude + 1e-6,
      );
      // y = baseY + (zStart − z)·slope + max(h, 0)·amplitude·(0.5 + 0.5·smoothstep(rise, |x|)),
      // the noise sampled at the node's own jittered (x, z) — so the node sits on the surface,
      // and the ridges keep rising outward instead of being cut off by the old |x| falloff
      const h =
        noise2D(x * r.lowScale, z * r.lowScale) * r.lowWeight +
        noise2D(x * r.highScale, z * r.highScale) * r.highWeight;
      const riseFactor = 0.5 + 0.5 * smoothstep(small.rise[0], small.rise[1], Math.abs(x));
      expect(y).toBeCloseTo(
        small.baseY +
          (small.zStart - z) * small.slope +
          Math.max(h, 0) * small.amplitude * riseFactor,
        5,
      );
    }
  });

  it("rises toward the back and keeps rising toward the frame edges", () => {
    // the shipped z range with few columns, and flat noise (h = 1 everywhere), isolates the two
    // shape terms from the ridges: y is baseY + (zStart − z)·slope + max(h, 0)·amplitude·rise
    const shape: typeof cfg = { ...cfg, cols: 20, dust: { ...cfg.dust, count: 10 } };
    const flat = landscape(shape, () => 1, mulberry32(2));
    const zBack = shape.zStart + (shape.rows - 1) * shape.zStep;
    const ps: [number, number, number][] = [];
    for (let i = 0; i < flat.nodeCount; i++) ps.push(xyz(flat.nodes, i));
    for (let i = 0; i < flat.goldNodeCount; i++) ps.push(xyz(flat.goldNodes, i));
    // the slope: the whole field rises toward the back
    const back = ps.filter(([, , z]) => z < (shape.zStart + zBack) / 2);
    const front = ps.filter(([, , z]) => z >= (shape.zStart + zBack) / 2);
    expect(meanY(back)).toBeGreaterThan(meanY(front) + 0.4);
    // the rise: the outer half of each side stands well above the inner half (the old falloff
    // did the opposite — it levelled off at |x| = 2.2 and never rose again)
    const mid = (shape.xStart + shape.xEnd) / 2;
    expect(meanY(ps.filter(([x]) => Math.abs(x) > mid))).toBeGreaterThan(
      meanY(ps.filter(([x]) => Math.abs(x) <= mid)) + 0.4,
    );
    // and the far ridges reach head height (bust.headCenter y = 1.45) at |x| ≈ rise[1]
    const edge = ps.filter(([x]) => Math.abs(x) > shape.rise[1] - 0.1);
    expect(Math.max(...edge.map(([, y]) => y))).toBeGreaterThan(1.4);
  });

  it("sizes nodes uniformly in nodeSize, gold at goldSizeFactor× that range", () => {
    for (let i = 0; i < m.nodeCount; i++) {
      expect(m.nodeSizes[i]).toBeGreaterThanOrEqual(small.nodeSize[0]);
      expect(m.nodeSizes[i]).toBeLessThanOrEqual(small.nodeSize[1]);
    }
    for (let i = 0; i < m.goldNodeCount; i++) {
      expect(m.goldNodeSizes[i]).toBeGreaterThanOrEqual(
        small.nodeSize[0] * small.goldSizeFactor - 1e-6,
      );
      expect(m.goldNodeSizes[i]).toBeLessThanOrEqual(
        small.nodeSize[1] * small.goldSizeFactor + 1e-6,
      );
    }
    // not all one value: the sizes really vary
    expect(new Set(Array.from(m.nodeSizes)).size).toBeGreaterThan(100);
  });

  it("fades only at the bottom of the frame: smoothstep(fade[0], fade[1], y) per node and endpoint", () => {
    for (let i = 0; i < m.nodeCount; i++)
      expect(m.nodeFade[i]).toBeCloseTo(
        smoothstep(small.fade[0], small.fade[1], all[i]?.[1] ?? 0),
        6,
      );
    for (let i = 0; i < m.goldNodeCount; i++)
      expect(m.goldNodeFade[i]).toBeCloseTo(
        smoothstep(small.fade[0], small.fade[1], all[m.nodeCount + i]?.[1] ?? 0),
        6,
      );
    expect(m.blueFade.length).toBe(m.blueCount * 2);
    expect(m.goldFade.length).toBe(m.goldCount * 2);
    for (let k = 0; k < m.blueCount; k++)
      for (const e of [0, 1])
        expect(m.blueFade[k * 2 + e]).toBeCloseTo(
          smoothstep(small.fade[0], small.fade[1], m.blue[k * 6 + e * 3 + 1] ?? 0),
          6,
        );
    // nothing above fade[1] is dimmed at all — there is no other fade
    for (let i = 0; i < m.nodeCount; i++)
      if ((all[i]?.[1] ?? 0) >= small.fade[1]) expect(m.nodeFade[i]).toBe(1);
    // and the surface does reach down through the fade band, so each side is filled to the
    // bottom edge of the frame rather than stopping above it
    expect(Math.min(...all.map(([, y]) => y))).toBeLessThan(small.fade[0]);
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
        expect(d).toBeLessThanOrEqual(small.maxEdge + 1e-5);
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
    // the grid hash finds what the O(n²) scan would: every node with a same-side neighbour
    // within maxEdge ends up with at least one edge
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
          Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) <= small.maxEdge,
      );
      if (!has) continue;
      connectable++;
      if ((degree[i] ?? 0) > 0) connected++;
    }
    expect(connectable).toBeGreaterThan(total * 0.99);
    expect(connected / connectable).toBeGreaterThanOrEqual(0.95);
  });

  it("makes the highest nodes gold, and an edge gold only when both its endpoints are", () => {
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
      const i = Math.round(
        ((Math.abs(x) - small.xStart) / (small.xEnd - small.xStart)) * small.cols,
      );
      (x < 0 ? columns.left : columns.right).add(i);
    }
    expect(columns.left.size).toBeGreaterThan(8);
    expect(columns.right.size).toBeGreaterThan(8);
  });

  it("scatters dust.count tiny points per side inside dust.radius of a node, carrying its fade", () => {
    expect(m.dustCount).toBe(2 * small.dust.count);
    expect(m.dust.length).toBe(m.dustCount * 3);
    expect(m.dustFade.length).toBe(m.dustCount);
    const r = small.dust.radius;
    // each point sits inside dust.radius of a node and carries that node's fade (not its own y)
    const fadeOf = [...Array.from(m.nodeFade), ...Array.from(m.goldNodeFade)];
    for (let i = 0; i < m.dustCount; i++) {
      const p = xyz(m.dust, i);
      const near = all.some(
        (b, j) =>
          Math.hypot(b[0] - p[0], b[1] - p[1], b[2] - p[2]) <= r + 1e-5 &&
          Math.abs((fadeOf[j] ?? -1) - (m.dustFade[i] ?? -2)) < 1e-6,
      );
      expect(near).toBe(true);
    }
    // both sides get points
    expect(m.dust.filter((_, i) => i % 3 === 0).some((x) => x < 0)).toBe(true);
    expect(m.dust.filter((_, i) => i % 3 === 0).some((x) => x > 0)).toBe(true);
  });

  it("is deterministic for a given noise and seed", () => {
    const a = landscape(small, noise2D, mulberry32(4));
    const b = landscape(small, noise2D, mulberry32(4));
    for (const k of [
      "nodes",
      "nodeSizes",
      "nodeFade",
      "goldNodes",
      "goldNodeSizes",
      "goldNodeFade",
      "dust",
      "dustFade",
      "blue",
      "blueFade",
      "gold",
      "goldFade",
    ] as const) {
      expect(Array.from(a[k])).toEqual(Array.from(b[k]));
    }
  });

  it("builds the shipped 161 × 40 grid quickly, with dust picked uniformly over the surface", () => {
    const t0 = performance.now();
    const full = landscape(cfg, noise2D, mulberry32(2));
    const ms = performance.now() - t0;
    const fullTotal = 2 * (cfg.cols + 1) * cfg.rows;
    expect(full.nodeCount + full.goldNodeCount).toBe(fullTotal);
    expect(full.goldNodeCount).toBe(Math.round(fullTotal * cfg.goldRatio));
    expect(full.dustCount).toBe(2 * cfg.dust.count);

    // dust picks its node uniformly, not by height²: its mean height matches the surface's
    const ys: number[] = [];
    for (let i = 0; i < full.nodeCount; i++) ys.push(full.nodes[i * 3 + 1] ?? 0);
    for (let i = 0; i < full.goldNodeCount; i++) ys.push(full.goldNodes[i * 3 + 1] ?? 0);
    const nodeMean = ys.reduce((s, y) => s + y, 0) / ys.length;
    let dustMean = 0;
    for (let i = 0; i < full.dustCount; i++) dustMean += full.dust[i * 3 + 1] ?? 0;
    dustMean /= full.dustCount;
    expect(Math.abs(dustMean - nodeMean)).toBeLessThan(0.1);

    // the counts Ali asked for, plus the shape of the network
    const index = new Map<string, number>();
    for (let i = 0; i < ys.length; i++) {
      const src = i < full.nodeCount ? full.nodes : full.goldNodes;
      const at = i < full.nodeCount ? i : i - full.nodeCount;
      index.set(key(xyz(src, at)), i);
    }
    const degree = new Uint16Array(ys.length);
    let maxLen = 0;
    for (const [seg, n] of [
      [full.blue, full.blueCount],
      [full.gold, full.goldCount],
    ] as const) {
      for (let k = 0; k < n; k++) {
        const p = xyz(seg, k * 2);
        const q = xyz(seg, k * 2 + 1);
        maxLen = Math.max(maxLen, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
        for (const c of [index.get(key(p)), index.get(key(q))])
          if (c !== undefined) degree[c] = (degree[c] ?? 0) + 1;
      }
    }
    const edgeTotal = full.blueCount + full.goldCount;
    const isolated = Array.from(degree).filter((d) => d === 0).length;
    // coverage: the surface spans the whole fade band — a good share of it is at full opacity
    // above fade[1], and it still runs off the bottom of the frame below fade[0]
    const lit = ys.filter((y) => y >= cfg.fade[1]).length / ys.length;
    const dark = ys.filter((y) => y <= cfg.fade[0]).length / ys.length;
    console.log(`[landscape 11.1] lit ${lit.toFixed(3)} · below the frame ${dark.toFixed(3)}`);
    expect(lit).toBeGreaterThan(0.25);
    expect(dark).toBeGreaterThan(0.05);
    console.log(
      `[landscape 11.1] ${ms.toFixed(0)} ms · nodes ${fullTotal} (blue ${full.nodeCount}, gold ` +
        `${full.goldNodeCount}) · edges ${edgeTotal} (blue ${full.blueCount}, gold ` +
        `${full.goldCount}) · dust ${full.dustCount} · max edge ${maxLen.toFixed(4)} · mean ` +
        `degree ${((2 * edgeTotal) / fullTotal).toFixed(2)} · isolated ${isolated}`,
    );
    expect(maxLen).toBeLessThanOrEqual(cfg.maxEdge + 1e-5);
    expect(isolated / fullTotal).toBeLessThan(0.01);
    expect(ms).toBeLessThan(1500);
  });
});
