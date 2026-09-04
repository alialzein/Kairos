import { describe, expect, it } from "vitest";
import { mulberry32, randomInSphere, randomOnSphere } from "./random";

describe("mulberry32", () => {
  it("is deterministic per seed and uniform-ish in [0,1)", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe("sphere sampling", () => {
  it("randomOnSphere has unit length; randomInSphere stays inside r", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const [x, y, z] = randomOnSphere(rng);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
      const [a, b, c] = randomInSphere(rng, 2);
      expect(Math.hypot(a, b, c)).toBeLessThanOrEqual(2);
    }
  });
});
