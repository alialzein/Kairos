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

// Phase 12.2 (Ali): the shipped grid is (200 + 1) × 60 = 12,060 nodes per side. The per-node
// assertions below are O(n²) (nearest-neighbour reachability, dust containment), so they run on a
// reduced 61 × 12 grid with 400 dust and 200 gold dust per side; the shipped config is covered by
// the counts, the uniform dust pick and the generation-time guard in the last test.
const small: typeof cfg = {
  ...cfg,
  cols: 60,
  rows: 12,
  dust: { ...cfg.dust, count: 400 },
  crest: { ...cfg.crest, dust: { ...cfg.crest.dust, count: 200 } },
};

describe("landscape (Phase 12.2: a dense plexus network with glowing ridge lines)", () => {
  const m = landscape(small, noise2D, mulberry32(2));
  const perSide = (small.cols + 1) * small.rows;
  const total = 2 * perSide;
  const crestPerCol = Math.round(small.rows * small.crest.ratio);
  const crestExpected = 2 * (small.cols + 1) * crestPerCol;
  const goldExpected = Math.round(crestExpected * small.crest.goldShare);
  const zFar = small.zStart + (small.rows - 1) * small.zStep;
  // every node, blue then gold, as one list — the split is only a draw-call split
  const all: [number, number, number][] = [];
  for (let i = 0; i < m.nodeCount; i++) all.push(xyz(m.nodes, i));
  for (let i = 0; i < m.goldNodeCount; i++) all.push(xyz(m.goldNodes, i));
  const indexOf = new Map(all.map((p, i) => [key(p), i]));
  // the crest set, read back off the brightness arrays (the shape of the crest — the top slice of
  // every column — is asserted column by column on the zero-jitter grid further down)
  const brightOf = [...Array.from(m.nodeBrightness), ...Array.from(m.goldNodeBrightness)];
  const fadeOf = [...Array.from(m.nodeFade), ...Array.from(m.goldNodeFade)];
  const isCrest = (i: number) => brightOf[i] === small.crest.brightness;
  const crestSet = new Set(all.filter((_, i) => isCrest(i)).map(key));

  it("places 2 × (cols + 1) × rows jittered nodes, split into a blue remainder and goldShare of the crest", () => {
    // crest = the top `crest.ratio` of every column; gold = round(goldShare · crest nodes)
    expect(m.crestCount).toBe(crestExpected);
    expect(m.goldNodeCount).toBe(goldExpected);
    expect(m.nodeCount).toBe(total - goldExpected);
    expect(m.nodes.length).toBe(m.nodeCount * 3);
    expect(m.nodeSizes.length).toBe(m.nodeCount);
    expect(m.nodeFade.length).toBe(m.nodeCount);
    expect(m.nodeBrightness.length).toBe(m.nodeCount);
    expect(m.goldNodes.length).toBe(m.goldNodeCount * 3);
    expect(m.goldNodeSizes.length).toBe(m.goldNodeCount);
    expect(m.goldNodeFade.length).toBe(m.goldNodeCount);
    expect(m.goldNodeBrightness.length).toBe(m.goldNodeCount);
    expect(all.length).toBe(total);
    // no two nodes land on the same spot (so the coordinate → index map below is sound)
    expect(indexOf.size).toBe(total);
    expect(crestSet.size).toBe(crestExpected);
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
    const shape: typeof cfg = {
      ...cfg,
      cols: 20,
      dust: { ...cfg.dust, count: 10 },
      crest: { ...cfg.crest, dust: { ...cfg.crest.dust, count: 10 } },
    };
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

  it("sizes nodes uniformly in nodeSize, crest at sizeFactor× and gold at goldSizeFactor× on top", () => {
    const { nodeSize: ns, crest: c } = small;
    for (let i = 0; i < m.nodeCount; i++) {
      // Phase 12.2: a blue node is either a plain slope node or a (non-gold) crest node
      const f = isCrest(i) ? c.sizeFactor : 1;
      expect(m.nodeSizes[i]).toBeGreaterThanOrEqual(ns[0] * f - 1e-6);
      expect(m.nodeSizes[i]).toBeLessThanOrEqual(ns[1] * f + 1e-6);
    }
    // every gold node is a crest node, so the two factors stack
    for (let i = 0; i < m.goldNodeCount; i++) {
      expect(m.goldNodeSizes[i]).toBeGreaterThanOrEqual(
        ns[0] * c.sizeFactor * small.goldSizeFactor - 1e-6,
      );
      expect(m.goldNodeSizes[i]).toBeLessThanOrEqual(
        ns[1] * c.sizeFactor * small.goldSizeFactor + 1e-6,
      );
    }
    // the crest really is bigger — the two ranges overlap (0.024–0.056 vs 0.015–0.035), so the
    // factor shows in the means, which are both draws from the same uniform range
    const crestSizes: number[] = [];
    const plainSizes: number[] = [];
    for (let i = 0; i < m.nodeCount; i++)
      (isCrest(i) ? crestSizes : plainSizes).push(m.nodeSizes[i] ?? 0);
    expect(crestSizes.length).toBe(crestExpected - m.goldNodeCount);
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const ratio = mean(crestSizes) / mean(plainSizes);
    expect(ratio).toBeGreaterThan(c.sizeFactor * 0.9); // ± 10 %: only ~120 crest nodes here
    expect(ratio).toBeLessThan(c.sizeFactor * 1.1);
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
    // and the surface starts inside the fade band (baseY sits at the frame's bottom edge), so
    // each side fills from the bottom up: the lowest node is partially faded, not cut off
    const minY = Math.min(...all.map(([, y]) => y));
    expect(minY).toBeLessThan(small.fade[1]);
    // (z jitter ahead of zStart lowers a node by at most jitter·slope)
    expect(minY).toBeGreaterThanOrEqual(small.baseY - small.jitter * small.slope - 1e-6);
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

  it("marks the top crest.ratio of every column as crest — that column's highest nodes", () => {
    // jitter 0 so every node's x recovers its own column exactly (at the shipped jitter the
    // columns overlap); 10 columns × 20 rows per side, crest = round(0.15 · 20) = 3 per column
    const cols: typeof cfg = {
      ...cfg,
      cols: 9,
      rows: 20,
      jitter: 0,
      dust: { ...cfg.dust, count: 10 },
      crest: { ...cfg.crest, dust: { ...cfg.crest.dust, count: 10 } },
    };
    const c = landscape(cols, noise2D, mulberry32(3));
    const per = Math.round(cols.rows * cols.crest.ratio);
    expect(per).toBe(3);
    expect(c.crestCount).toBe(2 * (cols.cols + 1) * per);
    // (node, is it crest?, is it gold?) over both draw calls
    const ns: { x: number; y: number; crest: boolean; gold: boolean }[] = [];
    for (let i = 0; i < c.nodeCount; i++)
      ns.push({
        x: c.nodes[i * 3] ?? 0,
        y: c.nodes[i * 3 + 1] ?? 0,
        crest: c.nodeBrightness[i] === cols.crest.brightness,
        gold: false,
      });
    for (let i = 0; i < c.goldNodeCount; i++)
      ns.push({
        x: c.goldNodes[i * 3] ?? 0,
        y: c.goldNodes[i * 3 + 1] ?? 0,
        crest: c.goldNodeBrightness[i] === cols.crest.brightness,
        gold: true,
      });
    const step = (cols.xEnd - cols.xStart) / cols.cols;
    const byColumn = new Map<string, typeof ns>();
    for (const n of ns) {
      const k = `${Math.sign(n.x)}:${Math.round((Math.abs(n.x) - cols.xStart) / step)}`;
      const bucket = byColumn.get(k);
      if (bucket) bucket.push(n);
      else byColumn.set(k, [n]);
    }
    expect(byColumn.size).toBe(2 * (cols.cols + 1));
    for (const bucket of byColumn.values()) {
      expect(bucket.length).toBe(cols.rows);
      const marked = bucket.filter((n) => n.crest);
      expect(marked.length).toBe(per);
      // the marked ones are exactly this column's `per` highest nodes
      const cut = [...bucket].sort((a, b) => b.y - a.y)[per - 1]?.y ?? 0;
      for (const n of marked) expect(n.y).toBeGreaterThanOrEqual(cut - 1e-9);
      for (const n of bucket) if (!n.crest) expect(n.y).toBeLessThanOrEqual(cut + 1e-9);
      // and every gold node in this column is one of them
      for (const n of bucket) if (n.gold) expect(n.crest).toBe(true);
    }
    // gold is goldShare of the crest, every one of them a crest node
    expect(c.goldNodeCount).toBe(Math.round(c.crestCount * cols.crest.goldShare));
    expect(ns.filter((n) => n.gold && n.crest).length).toBe(c.goldNodeCount);
  });

  it("brightens crest nodes and crest–crest edges by crest.brightness, everything else by 1", () => {
    const b = small.crest.brightness;
    expect(b).toBeGreaterThan(1); // a colour multiplier > 1 is what feeds bloom
    for (let i = 0; i < m.nodeCount; i++) expect(m.nodeBrightness[i]).toBe(isCrest(i) ? b : 1);
    // every gold node is a crest node, so the gold sprites are all at crest brightness
    for (let i = 0; i < m.goldNodeCount; i++) expect(m.goldNodeBrightness[i]).toBe(b);
    expect(m.blueBrightness.length).toBe(m.blueCount * 2);
    expect(m.goldBrightness.length).toBe(m.goldCount * 2);
    const check = (seg: Float32Array, bright: Float32Array, n: number) => {
      let hits = 0;
      for (let k = 0; k < n; k++) {
        const p = key(xyz(seg, k * 2));
        const q = key(xyz(seg, k * 2 + 1));
        const want = crestSet.has(p) && crestSet.has(q) ? b : 1;
        // per endpoint, like the fade arrays — both endpoints of an edge carry the same value
        expect(bright[k * 2]).toBe(want);
        expect(bright[k * 2 + 1]).toBe(want);
        if (want === b) hits++;
      }
      return hits;
    };
    const brightBlue = check(m.blue, m.blueBrightness, m.blueCount);
    const brightGold = check(m.gold, m.goldBrightness, m.goldCount);
    // both objects really carry ridge lines: a crest edge with one non-gold endpoint is drawn in
    // the blue object at crest brightness, a gold crest edge in the gold object
    expect(brightBlue).toBeGreaterThan(0);
    expect(brightGold).toBeGreaterThan(0);
    expect(brightGold).toBe(m.goldCount); // every gold edge joins two crest nodes
  });

  it("makes gold nodes crest nodes, and an edge gold only when both its endpoints are", () => {
    // gold sits on the skyline — but the crest is per column, not the globally highest nodes, so
    // the low columns beside the bust contribute crest too and the gap is smaller than Phase
    // 11.1's height²-weighted draw over the whole surface (measured 0.16 on this grid)
    expect(meanY(all.slice(m.nodeCount))).toBeGreaterThan(meanY(all.slice(0, m.nodeCount)) + 0.1);
    const goldSet = new Set(all.slice(m.nodeCount).map(key));
    for (const p of goldSet) expect(crestSet.has(p)).toBe(true);
    for (let k = 0; k < m.goldCount; k++) {
      expect(goldSet.has(key(xyz(m.gold, k * 2)))).toBe(true);
      expect(goldSet.has(key(xyz(m.gold, k * 2 + 1)))).toBe(true);
    }
    // and no blue edge has two gold endpoints
    for (let k = 0; k < m.blueCount; k++) {
      const a = goldSet.has(key(xyz(m.blue, k * 2)));
      const b = goldSet.has(key(xyz(m.blue, k * 2 + 1)));
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

  it("scatters crest.dust.count gold points per side inside crest.dust.radius of a crest node", () => {
    expect(m.goldDustCount).toBe(2 * small.crest.dust.count);
    expect(m.goldDust.length).toBe(m.goldDustCount * 3);
    expect(m.goldDustFade.length).toBe(m.goldDustCount);
    const r = small.crest.dust.radius;
    expect(r).toBeLessThan(small.dust.radius); // it hugs the ridge, it is not surface dust
    const crest = all.filter((_, i) => isCrest(i));
    const crestFade = fadeOf.filter((_, i) => isCrest(i));
    for (let i = 0; i < m.goldDustCount; i++) {
      const p = xyz(m.goldDust, i);
      const near = crest.some(
        (b, j) =>
          Math.hypot(b[0] - p[0], b[1] - p[1], b[2] - p[2]) <= r + 1e-5 &&
          Math.abs((crestFade[j] ?? -1) - (m.goldDustFade[i] ?? -2)) < 1e-6,
      );
      expect(near).toBe(true);
    }
    // both sides get points
    expect(m.goldDust.filter((_, i) => i % 3 === 0).some((x) => x < 0)).toBe(true);
    expect(m.goldDust.filter((_, i) => i % 3 === 0).some((x) => x > 0)).toBe(true);
  });

  it("is deterministic for a given noise and seed", () => {
    const a = landscape(small, noise2D, mulberry32(4));
    const b = landscape(small, noise2D, mulberry32(4));
    for (const k of [
      "nodes",
      "nodeSizes",
      "nodeFade",
      "nodeBrightness",
      "goldNodes",
      "goldNodeSizes",
      "goldNodeFade",
      "goldNodeBrightness",
      "dust",
      "dustFade",
      "goldDust",
      "goldDustFade",
      "blue",
      "blueFade",
      "blueBrightness",
      "gold",
      "goldFade",
      "goldBrightness",
    ] as const) {
      expect(Array.from(a[k])).toEqual(Array.from(b[k]));
    }
  });

  it("builds the shipped 201 × 60 grid quickly, with dust picked uniformly over the surface", () => {
    const t0 = performance.now();
    const full = landscape(cfg, noise2D, mulberry32(2));
    const ms = performance.now() - t0;
    const fullTotal = 2 * (cfg.cols + 1) * cfg.rows;
    const fullCrest = 2 * (cfg.cols + 1) * Math.round(cfg.rows * cfg.crest.ratio);
    expect(full.nodeCount + full.goldNodeCount).toBe(fullTotal);
    expect(fullTotal).toBeGreaterThanOrEqual(24000); // Ali: 12,000 nodes per side
    expect(full.crestCount).toBe(fullCrest);
    expect(full.goldNodeCount).toBe(Math.round(fullCrest * cfg.crest.goldShare));
    expect(full.dustCount).toBe(2 * cfg.dust.count);
    expect(full.goldDustCount).toBe(2 * cfg.crest.dust.count);

    // dust picks its node uniformly, not by height²: its mean height matches the surface's
    const ys: number[] = [];
    for (let i = 0; i < full.nodeCount; i++) ys.push(full.nodes[i * 3 + 1] ?? 0);
    for (let i = 0; i < full.goldNodeCount; i++) ys.push(full.goldNodes[i * 3 + 1] ?? 0);
    const nodeMean = ys.reduce((s, y) => s + y, 0) / ys.length;
    let dustMean = 0;
    for (let i = 0; i < full.dustCount; i++) dustMean += full.dust[i * 3 + 1] ?? 0;
    dustMean /= full.dustCount;
    expect(Math.abs(dustMean - nodeMean)).toBeLessThan(0.1);
    // the gold dust rides the crest, so it sits well above the surface mean
    let goldDustMean = 0;
    for (let i = 0; i < full.goldDustCount; i++) goldDustMean += full.goldDust[i * 3 + 1] ?? 0;
    goldDustMean /= full.goldDustCount;
    expect(goldDustMean).toBeGreaterThan(nodeMean + 0.2);

    // the counts Ali asked for, plus the shape of the network
    const index = new Map<string, number>();
    for (let i = 0; i < ys.length; i++) {
      const src = i < full.nodeCount ? full.nodes : full.goldNodes;
      const at = i < full.nodeCount ? i : i - full.nodeCount;
      index.set(key(xyz(src, at)), i);
    }
    const degree = new Uint16Array(ys.length);
    let maxLen = 0;
    let crestEdges = 0;
    for (const [seg, bright, n] of [
      [full.blue, full.blueBrightness, full.blueCount],
      [full.gold, full.goldBrightness, full.goldCount],
    ] as const) {
      for (let k = 0; k < n; k++) {
        const p = xyz(seg, k * 2);
        const q = xyz(seg, k * 2 + 1);
        maxLen = Math.max(maxLen, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
        if (bright[k * 2] === cfg.crest.brightness) crestEdges++;
        for (const c of [index.get(key(p)), index.get(key(q))])
          if (c !== undefined) degree[c] = (degree[c] ?? 0) + 1;
      }
    }
    const edgeTotal = full.blueCount + full.goldCount;
    const isolated = Array.from(degree).filter((d) => d === 0).length;
    expect(crestEdges).toBeGreaterThan(0);
    // coverage: a good share of the surface is at full opacity above fade[1], and the near rows
    // sit inside the fade band (baseY −0.7 is at the frame's bottom edge), so nothing is wasted
    // below fade[0] and the slope fades in from the bottom
    const lit = ys.filter((y) => y >= cfg.fade[1]).length / ys.length;
    const fading = ys.filter((y) => y > cfg.fade[0] && y < cfg.fade[1]).length / ys.length;
    const dark = ys.filter((y) => y <= cfg.fade[0]).length / ys.length;
    console.log(
      `[landscape 12.2] lit ${lit.toFixed(3)} · fading ${fading.toFixed(3)} · dark ${dark.toFixed(3)}`,
    );
    expect(lit).toBeGreaterThan(0.25);
    expect(fading).toBeGreaterThan(0.05);
    expect(dark).toBe(0);
    console.log(
      `[landscape 12.2] ${ms.toFixed(0)} ms · nodes ${fullTotal} (blue ${full.nodeCount}, gold ` +
        `${full.goldNodeCount}, crest ${full.crestCount}) · edges ${edgeTotal} (blue ` +
        `${full.blueCount}, gold ${full.goldCount}, crest ${crestEdges}) · dust ` +
        `${full.dustCount} · gold dust ${full.goldDustCount} · max edge ${maxLen.toFixed(4)} · ` +
        `mean degree ${((2 * edgeTotal) / fullTotal).toFixed(2)} · isolated ${isolated}`,
    );
    expect(maxLen).toBeLessThanOrEqual(cfg.maxEdge + 1e-5);
    expect(isolated / fullTotal).toBeLessThan(0.01);
    expect(ms).toBeLessThan(3000);
  });
});
