import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/avatar/sim/random";
import { sceneConfig } from "../sceneConfig";
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
