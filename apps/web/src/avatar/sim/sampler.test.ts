import { describe, expect, it } from "vitest";
import tiny from "./__fixtures__/bust-tiny.json";
import { boundsOf, Region, regionsFor, sampleSurface } from "./sampler";
import { mulberry32 } from "./random";

const positions = new Float32Array(tiny.positions);
const indices = new Uint32Array(tiny.indices);

describe("sampleSurface", () => {
  it("returns n points, deterministic per seed, inside the mesh bounds (+ jitter)", () => {
    const a = sampleSurface(positions, indices, 500, mulberry32(9), 0.02);
    const b = sampleSurface(positions, indices, 500, mulberry32(9), 0.02);
    expect(a.length).toBe(1500);
    expect(Array.from(a.slice(0, 30))).toEqual(Array.from(b.slice(0, 30)));
    const bb = boundsOf(a);
    expect(bb.min[0]).toBeGreaterThanOrEqual(-0.8 - 0.021);
    expect(bb.max[1]).toBeLessThanOrEqual(0.9 + 0.021);
  });
  it("spreads samples over the whole surface (both x halves populated)", () => {
    const p = sampleSurface(positions, indices, 2000, mulberry32(2));
    let left = 0;
    for (let i = 0; i < p.length; i += 3) if ((p[i] ?? 0) < 0) left++;
    expect(left / 2000).toBeGreaterThan(0.4);
    expect(left / 2000).toBeLessThan(0.6);
  });
});

describe("regionsFor", () => {
  it("labels head/face/neck/chest/shoulders by height and depth", () => {
    const pts = new Float32Array([
      0,
      0.85,
      -0.2, // head (back)
      0,
      0.85,
      0.28, // face (front of head)
      0,
      0.1,
      0, // neck (yN ≈ 0.56)
      0,
      -0.5,
      0, // chest
      0.75,
      -0.5,
      0, // shoulder
    ]);
    const r = regionsFor(pts, boundsOf(positions));
    expect(Array.from(r)).toEqual([
      Region.HEAD,
      Region.FACE,
      Region.NECK,
      Region.CHEST,
      Region.SHOULDERS,
    ]);
  });
});
