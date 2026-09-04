import { describe, expect, it } from "vitest";
import { curl, makeNoise } from "./noise";

describe("simplex noise", () => {
  it("is deterministic, bounded and continuous", () => {
    const n1 = makeNoise(3);
    const n2 = makeNoise(3);
    expect(n1(0.3, 0.7, 1.1)).toBe(n2(0.3, 0.7, 1.1));
    for (let i = 0; i < 200; i++) {
      const v = n1(i * 0.13, i * 0.07, i * 0.05);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(n1(1, 1, 1) - n1(1.001, 1, 1))).toBeLessThan(0.05);
  });
  it("different seeds differ", () => {
    // (0.5, 0.5, 0.5) sits on a simplex lattice vertex where every seed returns 0
    expect(makeNoise(1)(0.37, 0.61, 0.83)).not.toBe(makeNoise(2)(0.37, 0.61, 0.83));
  });
});

describe("curl", () => {
  it("returns a finite 3-vector that varies in space", () => {
    const n = makeNoise(5);
    const a = curl(n, 0.1, 0.2, 0.3);
    const b = curl(n, 1.1, 0.2, 0.3);
    expect(a.every(Number.isFinite)).toBe(true);
    expect(a).not.toEqual(b);
  });
});
