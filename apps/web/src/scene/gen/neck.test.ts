import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/avatar/sim/random";
import { neckCircuit, neckZ, type NeckParams } from "./neck";

const p: NeckParams = {
  jawY: 1.02,
  jawXs: [-0.22, -0.14, -0.06, 0.06, 0.14, 0.22],
  nodeY: 0.42,
  controlY: 0.75,
  controlXFactor: 0.6,
  neckRadius: 0.2,
  lift: 0.02,
  points: 40,
  strandPoints: 120,
  strandBrightness: [0.5, 1],
  branches: {
    perStrand: [2, 3],
    at: [0.3, 0.7],
    length: [0.12, 0.3],
    angle: [0.5, 1.1],
    beadsPerUnit: 200,
  },
  node: { points: 10, spread: 0.03, spokes: 6, spokeLength: 0.05 },
};

const bead = p.strandPoints;

describe("neckCircuit", () => {
  const c = neckCircuit(p, mulberry32(3));
  const seg = (i: number) => Array.from(c.segments.subarray(i * 6, i * 6 + 6));
  const perStrand = p.points - 1;

  it("emits 39 segments per strand plus the spokes", () => {
    expect(c.strandCount).toBe(6);
    expect(c.segments.length).toBe((6 * perStrand + 6) * 6);
  });
  it("starts each strand on the jaw and ends it at the sternum node, hugging the neck", () => {
    for (let k = 0; k < 6; k++) {
      const first = seg(k * perStrand);
      const last = seg(k * perStrand + perStrand - 1);
      expect(first[0]).toBeCloseTo(p.jawXs[k] ?? 0, 6);
      expect(first[1]).toBeCloseTo(p.jawY, 6);
      expect(last[3]).toBeCloseTo(0, 6);
      expect(last[4]).toBeCloseTo(p.nodeY, 6);
      for (let i = 0; i < perStrand; i++) {
        const s = seg(k * perStrand + i);
        expect(s[2]).toBeCloseTo(neckZ(s[0] ?? 0, 0.2, 0.02), 6);
        expect(s[5]).toBeCloseTo(neckZ(s[3] ?? 0, 0.2, 0.02), 6);
      }
    }
  });
  it("is left/right symmetric", () => {
    for (let i = 0; i < perStrand; i++) {
      const l = seg(i); // strand 0 (x −0.22)
      const r = seg(5 * perStrand + i); // strand 5 (x +0.22)
      expect(l[0]).toBeCloseTo(-(r[0] ?? 0), 6);
      expect(l[1]).toBeCloseTo(r[1] ?? 0, 6);
      expect(l[2]).toBeCloseTo(r[2] ?? 0, 6);
    }
  });
  it("radiates 6 spokes of the given length from the node and clusters points around it", () => {
    for (let k = 0; k < 6; k++) {
      const s = seg(6 * perStrand + k);
      expect(s[0]).toBeCloseTo(c.node[0], 6);
      expect(s[1]).toBeCloseTo(c.node[1], 6);
      expect(s[2]).toBeCloseTo(c.node[2], 6);
      const len = Math.hypot((s[3] ?? 0) - (s[0] ?? 0), (s[4] ?? 0) - (s[1] ?? 0));
      expect(len).toBeCloseTo(0.05, 6);
    }
    expect(c.nodePoints.length).toBe(30);
    for (let i = 0; i < 10; i++) {
      const d = Math.hypot(c.nodePoints[i * 3] ?? 0, (c.nodePoints[i * 3 + 1] ?? 0) - p.nodeY);
      expect(d).toBeLessThanOrEqual(0.03 + 1e-9);
    }
  });
  it("samples strandPoints beads per strand along each bezier, on the neck cylinder", () => {
    expect(c.strandPointCount).toBe(bead);
    expect(c.strandPoints.length).toBe(6 * bead * 3);
    for (let k = 0; k < 6; k++) {
      const at = (i: number) => {
        const o = (k * bead + i) * 3;
        return [c.strandPoints[o] ?? 0, c.strandPoints[o + 1] ?? 0, c.strandPoints[o + 2] ?? 0];
      };
      const first = at(0);
      const last = at(bead - 1);
      expect(first[0]).toBeCloseTo(p.jawXs[k] ?? 0, 6);
      expect(first[1]).toBeCloseTo(p.jawY, 6);
      expect(last[0]).toBeCloseTo(0, 6);
      expect(last[1]).toBeCloseTo(p.nodeY, 6);
      expect(last[2]).toBeCloseTo(c.node[2], 6);
      for (let i = 0; i < bead; i++) {
        const v = at(i);
        expect(v[2]).toBeCloseTo(neckZ(v[0] ?? 0, 0.2, 0.02), 6);
      }
    }
  });
  it("is deterministic per seed", () => {
    const a = neckCircuit(p, mulberry32(9)).nodePoints;
    const b = neckCircuit(p, mulberry32(9)).nodePoints;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

// Phase 11.3 (Ali): 2-3 sub-branches per strand, each leaving the strand at 30-70 % of its
// length, angled outward and down, beaded along its length and bright at both ends.
describe("neckCircuit branches (Phase 11.3)", () => {
  const c = neckCircuit(p, mulberry32(3));
  const xyz = (a: Float32Array, i: number) => ({
    x: a[i * 3] ?? 0,
    y: a[i * 3 + 1] ?? 0,
    z: a[i * 3 + 2] ?? 0,
  });
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
    expect(branchCount).toBeGreaterThanOrEqual(6 * p.branches.perStrand[0]);
    expect(branchCount).toBeLessThanOrEqual(6 * p.branches.perStrand[1]);
    const counts = new Array<number>(6).fill(0);
    for (let b = 0; b < branchCount; b++) {
      const o = xyz(c.endPoints, b * 2);
      const k = nearestBead(o.x, o.y).strand;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const n of counts) {
      expect(n).toBeGreaterThanOrEqual(p.branches.perStrand[0]);
      expect(n).toBeLessThanOrEqual(p.branches.perStrand[1]);
    }
  });

  it("roots every branch on its strand's bezier between at[0] and at[1]", () => {
    for (let b = 0; b < branchCount; b++) {
      const o = xyz(c.endPoints, b * 2);
      const near = nearestBead(o.x, o.y);
      expect(near.distance).toBeLessThan(0.01);
      expect(near.t).toBeGreaterThanOrEqual(p.branches.at[0] - 0.02);
      expect(near.t).toBeLessThanOrEqual(p.branches.at[1] + 0.02);
      expect(o.z).toBeCloseTo(neckZ(o.x, p.neckRadius, p.lift), 6);
    }
  });

  it("ends each branch `length` away from its origin, angled outward and down", () => {
    for (let b = 0; b < branchCount; b++) {
      const o = xyz(c.endPoints, b * 2);
      const tip = xyz(c.endPoints, b * 2 + 1);
      const d = Math.hypot(tip.x - o.x, tip.y - o.y); // xy: the z lift is not part of `length`
      expect(d).toBeGreaterThanOrEqual(p.branches.length[0] - 1e-3);
      expect(d).toBeLessThanOrEqual(p.branches.length[1] + 1e-3);
      expect(Math.abs(tip.x)).toBeGreaterThanOrEqual(Math.abs(o.x) - 1e-6); // outward
      expect(tip.y).toBeLessThanOrEqual(o.y + 1e-9); // down
      expect(tip.z).toBeCloseTo(neckZ(tip.x, p.neckRadius, p.lift), 6);
    }
  });

  it("beads every branch at `beadsPerUnit` and draws it as 12 fat-line segments", () => {
    expect(c.branchSegments.length).toBe(branchCount * 12 * 6);
    expect(c.branchPointCount).toBe(c.branchPoints.length / 3);
    const min = Math.max(4, Math.round(p.branches.length[0] * p.branches.beadsPerUnit));
    const max = Math.max(4, Math.round(p.branches.length[1] * p.branches.beadsPerUnit));
    expect(c.branchPointCount).toBeGreaterThanOrEqual(branchCount * min);
    expect(c.branchPointCount).toBeLessThanOrEqual(branchCount * max);
    for (let i = 0; i < c.branchPointCount; i++) {
      const v = xyz(c.branchPoints, i);
      expect(v.z).toBeCloseTo(neckZ(v.x, p.neckRadius, p.lift), 6);
    }
    for (let i = 0; i < c.branchSegments.length / 3; i++) {
      const v = xyz(c.branchSegments, i);
      expect(v.z).toBeCloseTo(neckZ(v.x, p.neckRadius, p.lift), 6);
    }
  });

  it("draws one brightness multiplier in [0.5, 1] per strand bead and per branch bead", () => {
    expect(c.strandBrightness.length).toBe(6 * bead);
    expect(c.branchBrightness.length).toBe(c.branchPointCount);
    for (const arr of [c.strandBrightness, c.branchBrightness]) {
      for (const v of arr) {
        expect(v).toBeGreaterThanOrEqual(p.strandBrightness[0]);
        expect(v).toBeLessThanOrEqual(p.strandBrightness[1]);
      }
      expect(new Set(arr).size).toBeGreaterThan(1); // drawn per bead, not one constant
    }
  });

  it("is deterministic per seed", () => {
    const a = neckCircuit(p, mulberry32(9));
    const b = neckCircuit(p, mulberry32(9));
    for (const key of [
      "branchSegments",
      "branchPoints",
      "endPoints",
      "strandBrightness",
      "branchBrightness",
    ] as const) {
      expect(Array.from(a[key])).toEqual(Array.from(b[key]));
    }
  });
});
