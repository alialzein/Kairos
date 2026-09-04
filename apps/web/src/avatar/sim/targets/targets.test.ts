import { describe, expect, it } from "vitest";
import tiny from "../__fixtures__/bust-tiny.json";
import { boundsOf } from "../sampler";
import { buildTargets, strided } from "./index";
import { core } from "./core";
import { nebula } from "./nebula";
import { orb } from "./orb";
import { ring } from "./ring";
import { spine } from "./spine";
import { waves } from "./waves";
import { mulberry32 } from "../random";

const bust = {
  positions: new Float32Array(tiny.positions),
  indices: new Uint32Array(tiny.indices),
  bounds: boundsOf(new Float32Array(tiny.positions)),
};
const first100 = (a: Float32Array) => Array.from(a.slice(0, 300)).map((v) => Number(v.toFixed(4)));

describe("generators are deterministic and sized", () => {
  it.each([
    ["orb", () => orb(1000, mulberry32(1))],
    ["nebula", () => nebula(1000, mulberry32(1))],
    ["ring", () => ring(1000, mulberry32(1))],
    ["core", () => core(1000, mulberry32(1))],
    ["waves", () => waves(1000, mulberry32(1))],
  ])("%s", (_name, gen) => {
    const a = gen();
    expect(a.length).toBe(3000);
    expect(first100(a)).toMatchSnapshot();
  });
  it("spine returns positions and a 0..1 parameter", () => {
    const s = spine(1000, mulberry32(1));
    expect(s.positions.length).toBe(3000);
    expect(s.t.length).toBe(1000);
    expect(Math.min(...s.t)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...s.t)).toBeLessThanOrEqual(1);
    expect(first100(s.positions)).toMatchSnapshot();
  });
});

describe("shape bounds match the spec", () => {
  it("orb radius ≤ 1, nebula within 2, ring near radius 1–1.5", () => {
    const o = orb(2000, mulberry32(3)),
      nb = nebula(2000, mulberry32(3)),
      rg = ring(2000, mulberry32(3));
    const rmax = (a: Float32Array) => {
      let m = 0;
      for (let i = 0; i < a.length; i += 3)
        m = Math.max(m, Math.hypot(a[i] ?? 0, a[i + 1] ?? 0, a[i + 2] ?? 0));
      return m;
    };
    expect(rmax(o)).toBeLessThanOrEqual(1.02);
    expect(rmax(nb)).toBeLessThanOrEqual(2.2);
    expect(rmax(rg)).toBeLessThanOrEqual(1.6);
  });
});

describe("buildTargets", () => {
  it("lays out core, spine, then shape; regions/spineT aligned; waves separate", () => {
    const t = buildTargets({ n: 1000, waves: 200, seed: 42, bust });
    expect(t.coreEnd).toBe(50);
    expect(t.spineEnd).toBe(70);
    for (const shape of [t.humanoid, t.orb, t.nebula, t.ring]) {
      expect(shape.length).toBe(3000);
      expect(Array.from(shape.slice(0, 150))).toEqual(Array.from(t.humanoid.slice(0, 150))); // core identical in every shape
    }
    expect(t.regions.length).toBe(1000);
    expect(t.spineT.length).toBe(1000);
    expect(t.spineT[60]).toBeGreaterThanOrEqual(0);
    expect(t.spineT[500]).toBe(0);
    expect(t.waves.length).toBe(600);
    expect(first100(t.humanoid)).toMatchSnapshot();
  });
  it("strided keeps proportions and determinism", () => {
    const t = buildTargets({ n: 1000, waves: 200, seed: 42, bust });
    const s = strided(t, 500);
    expect(s.n).toBe(500);
    expect(s.coreEnd).toBe(25);
    expect(s.spineEnd).toBe(35);
    expect(s.orb.length).toBe(1500);
    expect(s.waves.length).toBe(300);
    expect(Array.from(s.orb.slice(0, 3))).toEqual(Array.from(t.orb.slice(0, 3)));
  });
});
