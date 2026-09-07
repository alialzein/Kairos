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
  strandPoints: 60,
  node: { points: 10, spread: 0.03, spokes: 6, spokeLength: 0.05 },
};

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
    expect(c.strandPointCount).toBe(60);
    expect(c.strandPoints.length).toBe(6 * 60 * 3);
    for (let k = 0; k < 6; k++) {
      const at = (i: number) => {
        const o = (k * 60 + i) * 3;
        return [c.strandPoints[o] ?? 0, c.strandPoints[o + 1] ?? 0, c.strandPoints[o + 2] ?? 0];
      };
      const first = at(0);
      const last = at(59);
      expect(first[0]).toBeCloseTo(p.jawXs[k] ?? 0, 6);
      expect(first[1]).toBeCloseTo(p.jawY, 6);
      expect(last[0]).toBeCloseTo(0, 6);
      expect(last[1]).toBeCloseTo(p.nodeY, 6);
      expect(last[2]).toBeCloseTo(c.node[2], 6);
      for (let i = 0; i < 60; i++) {
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
