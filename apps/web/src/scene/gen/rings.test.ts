import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/avatar/sim/random";
import { sceneConfig } from "../sceneConfig";
import { driftPoints, ringPoints, ringSpecs } from "./rings";

describe("ringSpecs", () => {
  it("steps outward from innerRadius and fades from opacityFrom to opacityTo", () => {
    const r = ringSpecs(sceneConfig.rings);
    expect(r.length).toBe(9);
    expect(r[0]).toEqual({ radius: 0.9, opacity: sceneConfig.rings.opacityFrom });
    expect(r[8]?.radius).toBeCloseTo(0.9 + 8 * 0.25, 9);
    expect(r[8]?.opacity).toBeCloseTo(sceneConfig.rings.opacityTo, 9);
    for (let i = 1; i < r.length; i++) {
      expect((r[i]?.radius ?? 0) - (r[i - 1]?.radius ?? 0)).toBeCloseTo(0.25, 9);
      expect(r[i]?.opacity ?? 0).toBeLessThan(r[i - 1]?.opacity ?? 0);
    }
  });
  it("handles a single ring and zero rings", () => {
    expect(ringSpecs({ ...sceneConfig.rings, count: 1 })).toEqual([
      { radius: 0.9, opacity: sceneConfig.rings.opacityFrom },
    ]);
    expect(ringSpecs({ ...sceneConfig.rings, count: 0 })).toEqual([]);
  });
});

describe("ringPoints", () => {
  const spec = { radius: 1.5, opacity: 0.2 };
  const o = { perRing: 250, radialJitter: 0.03, thickness: 0.008 };
  const mid = spec.radius + o.thickness / 2;
  const p = ringPoints(spec, o, mulberry32(17));

  it("emits perRing xyz points, flat in the ring plane", () => {
    expect(p.length).toBe(o.perRing * 3);
    for (let i = 0; i < o.perRing; i++) expect(p[i * 3 + 2]).toBe(0);
  });
  it("keeps every point within radialJitter of the mid-annulus radius", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < o.perRing; i++) {
      const r = Math.hypot(p[i * 3] ?? 0, p[i * 3 + 1] ?? 0);
      expect(r).toBeGreaterThanOrEqual(mid - o.radialJitter - 1e-9);
      expect(r).toBeLessThanOrEqual(mid + o.radialJitter + 1e-9);
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    expect(min).toBeLessThan(mid);
    expect(max).toBeGreaterThan(mid);
  });
  it("spreads the points all the way round the circle", () => {
    const quadrants = [0, 0, 0, 0];
    for (let i = 0; i < o.perRing; i++) {
      const a = Math.atan2(p[i * 3 + 1] ?? 0, p[i * 3] ?? 0) + Math.PI;
      const q = Math.min(3, Math.floor((a / (Math.PI * 2)) * 4));
      quadrants[q] = (quadrants[q] ?? 0) + 1;
    }
    for (const q of quadrants) expect(q).toBeGreaterThan(0);
  });
  it("is deterministic per seed", () => {
    expect(Array.from(ringPoints(spec, o, mulberry32(4)))).toEqual(
      Array.from(ringPoints(spec, o, mulberry32(4))),
    );
  });
  it("emits nothing for zero points", () => {
    expect(ringPoints(spec, { ...o, perRing: 0 }, mulberry32(17)).length).toBe(0);
  });
});

describe("driftPoints", () => {
  const o = { count: 400, radius: 3.5, depth: [-1.3, 0.2] as [number, number] };
  const p = driftPoints(o, mulberry32(19));

  it("emits count points inside the disc, centred on the origin", () => {
    expect(p.length).toBe(o.count * 3);
    let max = 0;
    for (let i = 0; i < o.count; i++) {
      const r = Math.hypot(p[i * 3] ?? 0, p[i * 3 + 1] ?? 0);
      expect(r).toBeLessThanOrEqual(o.radius + 1e-9);
      max = Math.max(max, r);
    }
    expect(max).toBeGreaterThan(o.radius * 0.9); // uniform over the disc, not bunched at the centre
  });
  it("puts z uniformly in depth", () => {
    for (let i = 0; i < o.count; i++) {
      const z = p[i * 3 + 2] ?? 0;
      expect(z).toBeGreaterThanOrEqual(o.depth[0]);
      expect(z).toBeLessThanOrEqual(o.depth[1]);
    }
  });
  it("is deterministic per seed", () => {
    expect(Array.from(driftPoints(o, mulberry32(8)))).toEqual(
      Array.from(driftPoints(o, mulberry32(8))),
    );
  });
});
