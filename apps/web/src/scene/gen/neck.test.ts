import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/avatar/sim/random";
import { neckCircuit, neckZ, type NeckParams } from "./neck";

/** the shipped Phase 12.6 shape: 10 strands on a 0.3 cylinder, depth-2 branches, a nucleus */
const p: NeckParams = {
  jawY: 1.02,
  jawXs: [-0.27, -0.22, -0.165, -0.105, -0.045, 0.045, 0.105, 0.165, 0.22, 0.27],
  nodeY: 0.42,
  controlY: 0.75,
  controlXFactor: 0.6,
  neckRadius: 0.3,
  lift: 0.02,
  points: 40,
  strandPoints: 120,
  strandBrightness: [0.65, 1.3],
  branches: {
    perStrand: [2, 3],
    at: [0.3, 0.7],
    length: [0.12, 0.3],
    angle: [0.5, 1.1],
    beadsPerUnit: 200,
    depth: 2,
    sub: { perBranch: [1, 2], at: [0.4, 0.8], lengthFactor: 0.5 },
  },
  nucleus: {
    points: 300,
    radius: 0.08,
    coreRadius: 0.05,
    coreBrightness: 2.5,
    ringBrightness: 1.6,
    spokes: 6,
    spokeLength: 0.1,
  },
};

/** the same generator with the sub-branches switched off — Phase 11.3's exact behaviour */
const p1: NeckParams = { ...p, branches: { ...p.branches, depth: 1 } };

const bead = p.strandPoints;
const strands = p.jawXs.length;

const xyz = (a: Float32Array, i: number) => ({
  x: a[i * 3] ?? 0,
  y: a[i * 3 + 1] ?? 0,
  z: a[i * 3 + 2] ?? 0,
});

describe("neckCircuit", () => {
  const c = neckCircuit(p, mulberry32(3));
  const seg = (i: number) => Array.from(c.segments.subarray(i * 6, i * 6 + 6));
  const perStrand = p.points - 1;

  it("draws 10 strands of 39 segments plus the spokes", () => {
    expect(c.strandCount).toBe(10);
    expect(c.segments.length).toBe((strands * perStrand + p.nucleus.spokes) * 6);
  });
  it("starts each strand on the jaw and ends it at the sternum node, hugging the neck", () => {
    for (let k = 0; k < strands; k++) {
      const first = seg(k * perStrand);
      const last = seg(k * perStrand + perStrand - 1);
      expect(first[0]).toBeCloseTo(p.jawXs[k] ?? 0, 6);
      expect(first[1]).toBeCloseTo(p.jawY, 6);
      expect(last[3]).toBeCloseTo(0, 6);
      expect(last[4]).toBeCloseTo(p.nodeY, 6);
      for (let i = 0; i < perStrand; i++) {
        const s = seg(k * perStrand + i);
        expect(s[2]).toBeCloseTo(neckZ(s[0] ?? 0, 0.3, 0.02), 6);
        expect(s[5]).toBeCloseTo(neckZ(s[3] ?? 0, 0.3, 0.02), 6);
      }
    }
  });
  it("lifts the outermost strand onto the 0.3 cylinder rather than flattening it", () => {
    // |x| 0.27 > bust.neckRadius 0.2: on the old 0.2 cylinder the sqrt would clamp to 0 and the
    // strand would sit flat at `lift`; on the 0.3 cylinder it still wraps
    const first = seg(0);
    expect(first[2]).toBeGreaterThan(p.lift + 0.05);
    expect(first[2]).toBeCloseTo(Math.sqrt(0.3 * 0.3 - 0.27 * 0.27) + p.lift, 6);
  });
  it("is left/right symmetric", () => {
    for (let i = 0; i < perStrand; i++) {
      const l = seg(i); // strand 0 (x −0.27)
      const r = seg((strands - 1) * perStrand + i); // strand 9 (x +0.27)
      expect(l[0]).toBeCloseTo(-(r[0] ?? 0), 6);
      expect(l[1]).toBeCloseTo(r[1] ?? 0, 6);
      expect(l[2]).toBeCloseTo(r[2] ?? 0, 6);
    }
  });
  it("radiates 6 spokes of the given length from the node", () => {
    for (let k = 0; k < p.nucleus.spokes; k++) {
      const s = seg(strands * perStrand + k);
      expect(s[0]).toBeCloseTo(c.node[0], 6);
      expect(s[1]).toBeCloseTo(c.node[1], 6);
      expect(s[2]).toBeCloseTo(c.node[2], 6);
      const len = Math.hypot((s[3] ?? 0) - (s[0] ?? 0), (s[4] ?? 0) - (s[1] ?? 0));
      expect(len).toBeCloseTo(p.nucleus.spokeLength, 6);
    }
  });
  it("samples strandPoints beads per strand along each bezier, on the neck cylinder", () => {
    expect(c.strandPointCount).toBe(bead);
    expect(c.strandPoints.length).toBe(strands * bead * 3);
    for (let k = 0; k < strands; k++) {
      const at = (i: number) => xyz(c.strandPoints, k * bead + i);
      const first = at(0);
      const last = at(bead - 1);
      expect(first.x).toBeCloseTo(p.jawXs[k] ?? 0, 6);
      expect(first.y).toBeCloseTo(p.jawY, 6);
      expect(last.x).toBeCloseTo(0, 6);
      expect(last.y).toBeCloseTo(p.nodeY, 6);
      expect(last.z).toBeCloseTo(c.node[2], 6);
      for (let i = 0; i < bead; i++) {
        const v = at(i);
        expect(v.z).toBeCloseTo(neckZ(v.x, p.neckRadius, p.lift), 6);
      }
    }
  });
  it("is deterministic per seed", () => {
    const a = neckCircuit(p, mulberry32(9));
    const b = neckCircuit(p, mulberry32(9));
    for (const key of [
      "segments",
      "strandPoints",
      "strandBrightness",
      "branchSegments",
      "branchPoints",
      "branchBrightness",
      "endPoints",
      "nucleusPoints",
      "nucleusMix",
      "nucleusBrightness",
    ] as const) {
      expect(Array.from(a[key])).toEqual(Array.from(b[key]));
    }
  });
});

// Phase 11.3 (Ali): 2-3 sub-branches per strand, each leaving the strand at 30-70 % of its
// length, angled outward and down, beaded along its length and bright at both ends. Run against
// `depth: 1` params: Phase 12.6 must reproduce this exactly when the recursion is one level deep.
describe("neckCircuit branches at depth 1 (Phase 11.3)", () => {
  const c = neckCircuit(p1, mulberry32(3));
  const branchCount = c.endPointCount / 2;
  /** the strand bead nearest (x, y) — every branch origin sits on a strand bezier */
  const nearestBead = (x: number, y: number) => {
    let index = 0;
    let distance = Infinity;
    for (let i = 0; i < c.strandPoints.length / 3; i++) {
      const b = xyz(c.strandPoints, i);
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < distance) {
        distance = d;
        index = i;
      }
    }
    return { index, distance, strand: Math.floor(index / bead), t: (index % bead) / (bead - 1) };
  };

  it("draws 2-3 branches per strand and 2 end beads per branch", () => {
    expect(c.endPoints.length).toBe(c.endPointCount * 3);
    expect(branchCount).toBeGreaterThanOrEqual(strands * p1.branches.perStrand[0]);
    expect(branchCount).toBeLessThanOrEqual(strands * p1.branches.perStrand[1]);
    const counts = new Array<number>(strands).fill(0);
    for (let b = 0; b < branchCount; b++) {
      const o = xyz(c.endPoints, b * 2);
      const k = nearestBead(o.x, o.y).strand;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const n of counts) {
      expect(n).toBeGreaterThanOrEqual(p1.branches.perStrand[0]);
      expect(n).toBeLessThanOrEqual(p1.branches.perStrand[1]);
    }
  });

  it("roots every branch on its strand's bezier between at[0] and at[1]", () => {
    for (let b = 0; b < branchCount; b++) {
      const o = xyz(c.endPoints, b * 2);
      const near = nearestBead(o.x, o.y);
      expect(near.distance).toBeLessThan(0.01);
      expect(near.t).toBeGreaterThanOrEqual(p1.branches.at[0] - 0.02);
      expect(near.t).toBeLessThanOrEqual(p1.branches.at[1] + 0.02);
      expect(o.z).toBeCloseTo(neckZ(o.x, p1.neckRadius, p1.lift), 6);
    }
  });

  it("ends each branch `length` away from its origin, angled outward and down", () => {
    for (let b = 0; b < branchCount; b++) {
      const o = xyz(c.endPoints, b * 2);
      const tip = xyz(c.endPoints, b * 2 + 1);
      const d = Math.hypot(tip.x - o.x, tip.y - o.y); // xy: the z lift is not part of `length`
      expect(d).toBeGreaterThanOrEqual(p1.branches.length[0] - 1e-3);
      expect(d).toBeLessThanOrEqual(p1.branches.length[1] + 1e-3);
      expect(Math.abs(tip.x)).toBeGreaterThanOrEqual(Math.abs(o.x) - 1e-6); // outward
      expect(tip.y).toBeLessThanOrEqual(o.y + 1e-9); // down
      expect(tip.z).toBeCloseTo(neckZ(tip.x, p1.neckRadius, p1.lift), 6);
    }
  });

  it("beads every branch at `beadsPerUnit` and draws it as 12 fat-line segments", () => {
    expect(c.branchSegments.length).toBe(branchCount * 12 * 6);
    expect(c.branchPointCount).toBe(c.branchPoints.length / 3);
    const min = Math.max(4, Math.round(p1.branches.length[0] * p1.branches.beadsPerUnit));
    const max = Math.max(4, Math.round(p1.branches.length[1] * p1.branches.beadsPerUnit));
    expect(c.branchPointCount).toBeGreaterThanOrEqual(branchCount * min);
    expect(c.branchPointCount).toBeLessThanOrEqual(branchCount * max);
    for (let i = 0; i < c.branchPointCount; i++) {
      const v = xyz(c.branchPoints, i);
      expect(v.z).toBeCloseTo(neckZ(v.x, p1.neckRadius, p1.lift), 6);
    }
    for (let i = 0; i < c.branchSegments.length / 3; i++) {
      const v = xyz(c.branchSegments, i);
      expect(v.z).toBeCloseTo(neckZ(v.x, p1.neckRadius, p1.lift), 6);
    }
  });

  it("ignores `branches.sub` entirely at depth 1, so the rng stream is Phase 11.3's", () => {
    const other: NeckParams = {
      ...p1,
      branches: {
        ...p1.branches,
        sub: { perBranch: [3, 5], at: [0.1, 0.9], lengthFactor: 0.25 },
      },
    };
    const a = neckCircuit(p1, mulberry32(3));
    const b = neckCircuit(other, mulberry32(3));
    for (const key of [
      "branchSegments",
      "branchPoints",
      "endPoints",
      "strandBrightness",
      "branchBrightness",
      "nucleusPoints",
    ] as const) {
      expect(Array.from(b[key])).toEqual(Array.from(a[key]));
    }
  });
});

// Phase 12.6 (Ali): "sub-branches get their own sub-branches (depth 2)". The depth-1 branches are
// lengthened to 0.2–0.3 here so the sub-branches (×0.5 → 0.1–0.15) are unambiguously separable by
// length, which is what lets the test walk the emitted tree.
describe("neckCircuit sub-branches (Phase 12.6, depth 2)", () => {
  const p2: NeckParams = {
    ...p,
    branches: { ...p.branches, length: [0.2, 0.3], depth: 2 },
  };
  const c = neckCircuit(p2, mulberry32(3));
  const b = p2.branches;
  const beadsFor = (length: number) => Math.max(4, Math.round(length * b.beadsPerUnit));

  /** endPoints and branchPoints are emitted branch by branch in the same order, so the flat bead
   *  array can be cut back into per-branch polylines using each branch's own length. */
  const tree = () => {
    const out: { origin: { x: number; y: number }; length: number; from: number; beads: number }[] =
      [];
    let offset = 0;
    for (let i = 0; i < c.endPointCount / 2; i++) {
      const o = xyz(c.endPoints, i * 2);
      const tip = xyz(c.endPoints, i * 2 + 1);
      const length = Math.hypot(tip.x - o.x, tip.y - o.y);
      const beads = beadsFor(length);
      out.push({ origin: o, length, from: offset, beads });
      offset += beads;
    }
    expect(offset).toBe(c.branchPointCount);
    return out;
  };
  const isSub = (length: number) => length < 0.175; // 0.1–0.15 vs 0.2–0.3

  it("keeps the depth-1 branches and adds 1-2 sub-branches to each", () => {
    const all = tree();
    const depth1 = all.filter((x) => !isSub(x.length));
    const subs = all.filter((x) => isSub(x.length));
    // the depth-1 layer is still `perStrand` branches per strand — the recursion only adds
    expect(depth1.length).toBeGreaterThanOrEqual(strands * b.perStrand[0]);
    expect(depth1.length).toBeLessThanOrEqual(strands * b.perStrand[1]);
    expect(all.length).toBe(depth1.length + subs.length);
    expect(subs.length).toBeGreaterThanOrEqual(depth1.length * b.sub.perBranch[0]);
    expect(subs.length).toBeLessThanOrEqual(depth1.length * b.sub.perBranch[1]);
  });

  it("roots every sub-branch on its parent branch at 40-80 % of it, at half its length", () => {
    const all = tree();
    let parent = all[0];
    expect(parent).toBeDefined();
    for (const branch of all) {
      if (!isSub(branch.length)) {
        parent = branch;
        continue;
      }
      const p0 = parent;
      expect(p0).toBeDefined();
      if (!p0) continue;
      expect(branch.length).toBeCloseTo(p0.length * b.sub.lengthFactor, 3);
      let nearest = Infinity;
      let t = 0;
      for (let i = 0; i < p0.beads; i++) {
        const v = xyz(c.branchPoints, p0.from + i);
        const d = Math.hypot(v.x - branch.origin.x, v.y - branch.origin.y);
        if (d < nearest) {
          nearest = d;
          t = i / (p0.beads - 1);
        }
      }
      expect(nearest).toBeLessThan(0.01);
      expect(t).toBeGreaterThanOrEqual(b.sub.at[0] - 0.05);
      expect(t).toBeLessThanOrEqual(b.sub.at[1] + 0.05);
    }
  });

  it("folds the sub-branches into the branch segments, beads and end beads", () => {
    const all = tree();
    expect(c.branchSegments.length).toBe(all.length * 12 * 6);
    expect(c.endPointCount).toBe(all.length * 2);
    expect(c.branchBrightness.length).toBe(c.branchPointCount);
    for (let i = 0; i < c.branchPointCount; i++) {
      const v = xyz(c.branchPoints, i);
      expect(v.z).toBeCloseTo(neckZ(v.x, p2.neckRadius, p2.lift), 6);
    }
  });

  it("draws one brightness multiplier in [0.65, 1.3] per strand bead and per branch bead", () => {
    expect(c.strandBrightness.length).toBe(strands * bead);
    for (const arr of [c.strandBrightness, c.branchBrightness]) {
      for (const v of arr) {
        expect(v).toBeGreaterThanOrEqual(p2.strandBrightness[0]);
        expect(v).toBeLessThanOrEqual(p2.strandBrightness[1]);
      }
      expect(new Set(arr).size).toBeGreaterThan(1); // drawn per bead, not one constant
    }
  });
});

// Phase 12.6 (Ali): the sternum node becomes a nucleus — 300 points, blue-white inside
// `coreRadius`, gold beyond it, bright enough to bloom.
describe("neckCircuit nucleus (Phase 12.6)", () => {
  const c = neckCircuit(p, mulberry32(3));
  const n = p.nucleus;
  const radiusOf = (i: number) => {
    const v = xyz(c.nucleusPoints, i);
    return { r: Math.hypot(v.x, v.y - p.nodeY), z: v.z };
  };

  it("scatters `points` points inside `radius`, flat on the node's z", () => {
    expect(c.nucleusPoints.length).toBe(n.points * 3);
    expect(c.nucleusMix.length).toBe(n.points);
    expect(c.nucleusBrightness.length).toBe(n.points);
    for (let i = 0; i < n.points; i++) {
      const { r, z } = radiusOf(i);
      expect(r).toBeLessThanOrEqual(n.radius + 1e-9);
      expect(z).toBeCloseTo(c.node[2], 6);
    }
  });

  it("mixes 0 (blue-white) inside coreRadius and 1 (gold) outside it", () => {
    let inside = 0;
    let outside = 0;
    for (let i = 0; i < n.points; i++) {
      const { r } = radiusOf(i);
      if (r < n.coreRadius) {
        expect(c.nucleusMix[i]).toBe(0);
        inside++;
      } else {
        expect(c.nucleusMix[i]).toBe(1);
        outside++;
      }
    }
    expect(inside).toBeGreaterThan(0);
    expect(outside).toBeGreaterThan(0);
  });

  it("gives the core and the ring their configured bloom brightness", () => {
    for (let i = 0; i < n.points; i++) {
      const { r } = radiusOf(i);
      expect(c.nucleusBrightness[i]).toBeCloseTo(
        r < n.coreRadius ? n.coreBrightness : n.ringBrightness,
        6,
      );
    }
  });

  it("sits at the sternum node the strands feed into", () => {
    expect(c.node[0]).toBeCloseTo(0, 6);
    expect(c.node[1]).toBeCloseTo(p.nodeY, 6);
    expect(c.node[2]).toBeCloseTo(neckZ(0, p.neckRadius, p.lift), 6);
  });
});
