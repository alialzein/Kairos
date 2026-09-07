import { describe, expect, it } from "vitest";
import { makeNoise } from "@/avatar/sim/noise";
import { mulberry32 } from "@/avatar/sim/random";
import { sceneConfig } from "../sceneConfig";
import { ringPoints, ringSpecs } from "./rings";

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
  const o = {
    perRing: 1500,
    radialJitter: 0.03,
    thickness: 0.008,
    density: { scale: 3, floor: 0.15 },
    brightness: [0.5, 1.2] as [number, number],
  };
  const mid = spec.radius + o.thickness / 2;
  const noise = makeNoise(29);
  const p = ringPoints(spec, o, 0, noise, mulberry32(17));

  /** counts of the emitted points in `bins` equal angular bins, bin 0 starting at angle 0 */
  const binCounts = (points: Float32Array, bins: number) => {
    const out = new Array<number>(bins).fill(0);
    for (let i = 0; i < points.length / 3; i++) {
      const a = Math.atan2(points[i * 3 + 1] ?? 0, points[i * 3] ?? 0);
      const t = (a + Math.PI * 2) % (Math.PI * 2);
      const b = Math.min(bins - 1, Math.floor((t / (Math.PI * 2)) * bins));
      out[b] = (out[b] ?? 0) + 1;
    }
    return out;
  };

  it("emits exactly perRing xyz points, flat in the ring plane", () => {
    expect(p.count).toBe(o.perRing);
    expect(p.points.length).toBe(o.perRing * 3);
    for (let i = 0; i < p.count; i++) expect(p.points[i * 3 + 2]).toBe(0);
  });

  it("keeps every point within radialJitter of the mid-annulus radius", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.points[i * 3] ?? 0, p.points[i * 3 + 1] ?? 0);
      expect(r).toBeGreaterThanOrEqual(mid - o.radialJitter - 1e-9);
      expect(r).toBeLessThanOrEqual(mid + o.radialJitter + 1e-9);
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    expect(min).toBeLessThan(mid);
    expect(max).toBeGreaterThan(mid);
  });

  it("draws one brightness per point, uniform inside the configured range", () => {
    expect(p.brightness.length).toBe(o.perRing);
    let min = Infinity;
    let max = -Infinity;
    for (const b of p.brightness) {
      expect(b).toBeGreaterThanOrEqual(o.brightness[0]);
      expect(b).toBeLessThanOrEqual(o.brightness[1]);
      min = Math.min(min, b);
      max = Math.max(max, b);
    }
    // a genuine spread, not a constant
    expect(min).toBeLessThan(0.6);
    expect(max).toBeGreaterThan(1.1);
  });

  it("spreads the points all the way round the circle", () => {
    for (const q of binCounts(p.points, 4)) expect(q).toBeGreaterThan(0);
  });

  it("varies the density round the ring: some arcs dense, some sparse", () => {
    const bins = binCounts(p.points, 24);
    expect(Math.max(...bins)).toBeGreaterThanOrEqual(2 * Math.min(...bins));
  });

  it("is roughly uniform when the density field is constant", () => {
    const flat = ringPoints(spec, o, 0, () => 0, mulberry32(17));
    const bins = binCounts(flat.points, 24);
    expect(flat.count).toBe(o.perRing);
    expect(Math.max(...bins)).toBeLessThanOrEqual(2 * Math.min(...bins));
  });

  it("has no seam at 2π: the first and last bins differ no more than neighbouring bins do", () => {
    const bins = binCounts(p.points, 24);
    let worstInside = 0;
    for (let i = 1; i < bins.length; i++) {
      worstInside = Math.max(worstInside, Math.abs((bins[i] ?? 0) - (bins[i - 1] ?? 0)));
    }
    const seam = Math.abs((bins[0] ?? 0) - (bins[bins.length - 1] ?? 0));
    expect(seam).toBeLessThanOrEqual(worstInside);
  });

  it("gives different rings different density patterns", () => {
    const a = ringPoints(spec, o, 0, noise, mulberry32(17));
    const b = ringPoints(spec, o, 5, noise, mulberry32(17));
    expect(Array.from(b.points)).not.toEqual(Array.from(a.points));
  });

  it("is deterministic per seed", () => {
    const a = ringPoints(spec, o, 2, makeNoise(29), mulberry32(4));
    const b = ringPoints(spec, o, 2, makeNoise(29), mulberry32(4));
    expect(Array.from(a.points)).toEqual(Array.from(b.points));
    expect(Array.from(a.brightness)).toEqual(Array.from(b.brightness));
  });

  it("emits nothing for zero points", () => {
    const z = ringPoints(spec, { ...o, perRing: 0 }, 0, noise, mulberry32(17));
    expect(z.count).toBe(0);
    expect(z.points.length).toBe(0);
    expect(z.brightness.length).toBe(0);
  });

  it("gives up after perRing · 20 attempts instead of looping forever", () => {
    // a density field that rejects everything: floor 0, noise pinned at −1 → probability 0
    const dead = ringPoints(
      spec,
      { ...o, perRing: 100, density: { scale: 3, floor: 0 } },
      0,
      () => -1,
      mulberry32(17),
    );
    expect(dead.count).toBe(0);
    expect(dead.points.length).toBe(0);
    expect(dead.brightness.length).toBe(0);
  });
});
