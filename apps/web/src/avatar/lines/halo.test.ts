import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sim/random";
import { HALO_CENTER, HALO_RINGS, haloRingSegments, plumePoints, starPoints } from "./halo";

describe("haloRingSegments", () => {
  it("emits closed dashed rings at the configured radii behind the head", () => {
    const g = haloRingSegments();
    const per = g.segRing.length / HALO_RINGS.length;
    expect(Number.isInteger(per)).toBe(true);
    expect(g.segments.length).toBe(g.segRing.length * 6);
    for (let s = 0; s < g.segRing.length; s++) {
      const ring = HALO_RINGS[g.segRing[s] ?? 0]!;
      const dx = (g.segments[s * 6] ?? 0) - HALO_CENTER[0];
      const dy = ((g.segments[s * 6 + 1] ?? 0) - HALO_CENTER[1]) / 0.94;
      expect(Math.hypot(dx, dy)).toBeCloseTo(ring.r, 5);
      expect(g.segments[s * 6 + 2]).toBeCloseTo(HALO_CENTER[2], 5);
      expect(Math.abs(g.segDir[s] ?? 0)).toBe(1);
    }
    // each ring closes: last segment's end equals first segment's start
    for (let k = 0; k < HALO_RINGS.length; k++) {
      const first = k * per;
      const last = first + per - 1;
      expect(g.segments[last * 6 + 3]).toBeCloseTo(g.segments[first * 6] ?? 0, 5);
      expect(g.segments[last * 6 + 4]).toBeCloseTo(g.segments[first * 6 + 1] ?? 0, 5);
    }
  });
});

describe("plumePoints / starPoints", () => {
  it("plume spawns in a narrow cone above the crown, deterministic per seed", () => {
    const a = plumePoints(500, mulberry32(2));
    const b = plumePoints(500, mulberry32(2));
    expect(Array.from(a.points.slice(0, 30))).toEqual(Array.from(b.points.slice(0, 30)));
    for (let i = 0; i < 500; i++) {
      expect(Math.abs(a.points[i * 3] ?? 0)).toBeLessThanOrEqual(0.16);
      expect(a.points[i * 3 + 1] ?? 0).toBeGreaterThanOrEqual(0.86);
      expect(a.seeds[i]).toBeGreaterThanOrEqual(0);
      expect(a.seeds[i]).toBeLessThan(1);
    }
  });
  it("stars sit far behind the scene", () => {
    const s = starPoints(1000, mulberry32(9));
    for (let i = 0; i < 1000; i++) expect(s[i * 3 + 2] ?? 0).toBeLessThanOrEqual(-3.5);
  });
});
