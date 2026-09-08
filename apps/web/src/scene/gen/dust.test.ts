import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/avatar/sim/random";
import { sceneConfig, type Vec3 } from "../sceneConfig";
import { boxPoints, plumeSeeds } from "./dust";

describe("boxPoints", () => {
  const o = {
    center: [0, 0.8, -0.4] as [number, number, number],
    size: [6, 4, 3] as [number, number, number],
    count: 2500,
  };
  const p = boxPoints(o, mulberry32(19));

  it("emits count xyz points inside the box", () => {
    expect(p.length).toBe(o.count * 3);
    for (let i = 0; i < o.count; i++) {
      for (let a = 0; a < 3; a++) {
        const v = p[i * 3 + a] ?? 0;
        expect(v).toBeGreaterThanOrEqual((o.center[a] ?? 0) - (o.size[a] ?? 0) / 2 - 1e-9);
        expect(v).toBeLessThanOrEqual((o.center[a] ?? 0) + (o.size[a] ?? 0) / 2 + 1e-9);
      }
    }
  });

  it("fills the box on every axis (uniform, not bunched in the middle)", () => {
    for (let a = 0; a < 3; a++) {
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      for (let i = 0; i < o.count; i++) {
        const v = p[i * 3 + a] ?? 0;
        min = Math.min(min, v);
        max = Math.max(max, v);
        sum += v;
      }
      const half = (o.size[a] ?? 0) / 2;
      const c = o.center[a] ?? 0;
      expect(min).toBeLessThan(c - half * 0.9);
      expect(max).toBeGreaterThan(c + half * 0.9);
      expect(sum / o.count).toBeCloseTo(c, 1);
    }
  });

  it("is deterministic per seed", () => {
    expect(Array.from(boxPoints(o, mulberry32(8)))).toEqual(
      Array.from(boxPoints(o, mulberry32(8))),
    );
  });

  it("emits nothing for zero points", () => {
    expect(boxPoints({ ...o, count: 0 }, mulberry32(19)).length).toBe(0);
  });

  it("matches the configured ambient dust volume", () => {
    const a = sceneConfig.dust.ambient;
    expect(boxPoints(a, mulberry32(a.seed)).length).toBe(a.count * 3);
  });
});

describe("boxPoints focus (Phase 13.3)", () => {
  const box = {
    center: [0, 0.8, -0.4] as Vec3,
    size: [6, 4, 3] as Vec3,
    count: 20000,
  };
  const focus = { center: [0, 1.45, 0] as Vec3, falloff: 1 };
  const o = { ...box, focus };
  const p = boxPoints(o, mulberry32(19));
  /** distance from the focus centre of point `i` */
  const dist = (pts: Float32Array, i: number) =>
    Math.hypot(
      (pts[i * 3] ?? 0) - focus.center[0],
      (pts[i * 3 + 1] ?? 0) - focus.center[1],
      (pts[i * 3 + 2] ?? 0) - focus.center[2],
    );
  /** mean of the keep weight 1 / (1 + (d / falloff)²) over a draw */
  const meanWeight = (pts: Float32Array) => {
    const n = pts.length / 3;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = dist(pts, i) / focus.falloff;
      sum += 1 / (1 + d * d);
    }
    return sum / n;
  };

  it("still emits count xyz points inside the box", () => {
    expect(p.length).toBe(o.count * 3);
    for (let i = 0; i < o.count; i++) {
      for (let a = 0; a < 3; a++) {
        const v = p[i * 3 + a] ?? 0;
        expect(v).toBeGreaterThanOrEqual((o.center[a] ?? 0) - (o.size[a] ?? 0) / 2 - 1e-9);
        expect(v).toBeLessThanOrEqual((o.center[a] ?? 0) + (o.size[a] ?? 0) / 2 + 1e-9);
      }
    }
  });

  it("pulls the cloud toward the focus centre", () => {
    const uniform = boxPoints(box, mulberry32(19));
    // rejection sampling on w = 1 / (1 + d²) makes the accepted mean E[w²] / E[w], so the ratio
    // against the uniform draw is exactly w's coefficient of variation, E[w²] / E[w]². Over this
    // 6 × 4 × 3 box at falloff 1 that is ~1.49 — it is a whole-cloud average, deliberately much
    // flatter than the near/far density ratio the next test measures.
    expect(meanWeight(p)).toBeGreaterThan(1.4 * meanWeight(uniform));
  });

  it("falls off with distance: the innermost shell is > 5× as dense as the outermost", () => {
    const uniform = boxPoints(box, mulberry32(19));
    const edges = [0, 0.5, 1, 2, 3];
    const shell = (pts: Float32Array) => {
      const bins = [0, 0, 0, 0];
      for (let i = 0; i < pts.length / 3; i++) {
        const d = dist(pts, i);
        for (let b = 0; b < 4; b++) {
          if (d >= (edges[b] ?? 0) && d < (edges[b + 1] ?? 0)) bins[b] = (bins[b] ?? 0) + 1;
        }
      }
      return bins;
    };
    const got = shell(p);
    const even = shell(uniform);
    // the uniform draw is a Monte-Carlo measure of each shell's volume clipped to the box, so
    // focused / uniform per shell IS the density per unit volume (both draws have `count` points)
    const density = got.map((c, b) => c / (even[b] ?? 1));
    expect(even.every((c) => c > 100)).toBe(true); // every shell measured on enough samples
    expect(density[0] ?? 0).toBeGreaterThan(5 * (density[3] ?? 0));
    for (let b = 1; b < 4; b++) expect(density[b] ?? 0).toBeLessThan(density[b - 1] ?? 0);
  });

  it("is deterministic per seed", () => {
    expect(Array.from(boxPoints(o, mulberry32(8)))).toEqual(
      Array.from(boxPoints(o, mulberry32(8))),
    );
  });

  it("caps the attempts and returns a shorter array when nothing is accepted", () => {
    const starved = boxPoints(
      { ...box, count: 200, focus: { ...focus, falloff: 1e-6 } },
      mulberry32(5),
    );
    expect(starved.length % 3).toBe(0);
    expect(starved.length).toBeLessThan(200 * 3); // count · 50 attempts, ~none accepted
  });

  it("leaves the unfocused draw untouched", () => {
    expect(Array.from(boxPoints({ ...box, count: 500 }, mulberry32(3)))).toEqual(
      Array.from(boxPoints({ ...box, count: 500, focus: undefined }, mulberry32(3))),
    );
  });

  it("matches the configured ambient focus", () => {
    const a = sceneConfig.dust.ambient;
    expect(a.focus.center).toEqual(sceneConfig.bust.headCenter);
    expect(boxPoints(a, mulberry32(a.seed)).length).toBe(a.count * 3);
  });
});

describe("plumeSeeds", () => {
  const o = { count: 1500, speedJitter: [0.7, 1.3] as [number, number] };
  const s = plumeSeeds(o, mulberry32(23));

  it("emits one unit-disc sample, phase and speed per particle", () => {
    expect(s.disc.length).toBe(o.count * 2);
    expect(s.phase.length).toBe(o.count);
    expect(s.speed.length).toBe(o.count);
  });

  it("keeps every disc sample inside the unit circle and spreads it over the disc", () => {
    let max = 0;
    const quadrants = [0, 0, 0, 0];
    for (let i = 0; i < o.count; i++) {
      const ux = s.disc[i * 2] ?? 0;
      const uz = s.disc[i * 2 + 1] ?? 0;
      const r = Math.hypot(ux, uz);
      expect(r).toBeLessThanOrEqual(1 + 1e-9);
      max = Math.max(max, r);
      const a = Math.atan2(uz, ux) + Math.PI;
      const q = Math.min(3, Math.floor((a / (Math.PI * 2)) * 4));
      quadrants[q] = (quadrants[q] ?? 0) + 1;
    }
    expect(max).toBeGreaterThan(0.9); // r = √u fills the disc, it does not bunch at the centre
    for (const q of quadrants) expect(q).toBeGreaterThan(0);
  });

  it("puts phase in [0, 1) and speed inside speedJitter", () => {
    for (let i = 0; i < o.count; i++) {
      const ph = s.phase[i] ?? -1;
      expect(ph).toBeGreaterThanOrEqual(0);
      expect(ph).toBeLessThan(1);
      const sp = s.speed[i] ?? 0;
      expect(sp).toBeGreaterThanOrEqual(o.speedJitter[0]);
      expect(sp).toBeLessThanOrEqual(o.speedJitter[1]);
    }
  });

  it("spreads phase over the whole cycle so the cone is full at any instant", () => {
    let min = 1;
    let max = 0;
    for (let i = 0; i < o.count; i++) {
      min = Math.min(min, s.phase[i] ?? 0);
      max = Math.max(max, s.phase[i] ?? 0);
    }
    expect(min).toBeLessThan(0.05);
    expect(max).toBeGreaterThan(0.95);
  });

  it("is deterministic per seed", () => {
    const a = plumeSeeds(o, mulberry32(4));
    const b = plumeSeeds(o, mulberry32(4));
    expect(Array.from(a.disc)).toEqual(Array.from(b.disc));
    expect(Array.from(a.phase)).toEqual(Array.from(b.phase));
    expect(Array.from(a.speed)).toEqual(Array.from(b.speed));
  });

  it("emits nothing for zero particles", () => {
    const z = plumeSeeds({ ...o, count: 0 }, mulberry32(23));
    expect(z.disc.length).toBe(0);
    expect(z.phase.length).toBe(0);
    expect(z.speed.length).toBe(0);
  });
});
