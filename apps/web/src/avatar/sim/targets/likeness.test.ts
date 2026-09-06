import { describe, expect, it } from "vitest";
import tiny from "../__fixtures__/bust-tiny.json";
import { boundsOf } from "../sampler";
import { humanoid } from "./humanoid";
import { applyLikeness } from "./likeness";
import { mulberry32 } from "../random";

const bust = {
  positions: new Float32Array(tiny.positions),
  indices: new Uint32Array(tiny.indices),
  bounds: boundsOf(new Float32Array(tiny.positions)),
};

function build(seed: number) {
  const hu = humanoid(4000, mulberry32(seed), bust);
  applyLikeness(hu.positions, hu.normals, hu.regions, mulberry32(seed + 1));
  return hu;
}

describe("applyLikeness", () => {
  it("is deterministic and keeps arrays finite and sized", () => {
    const a = build(7);
    const b = build(7);
    expect(a.positions.length).toBe(12000);
    expect(Array.from(a.positions.slice(0, 60))).toEqual(Array.from(b.positions.slice(0, 60)));
    for (let i = 0; i < a.positions.length; i++) expect(Number.isFinite(a.positions[i])).toBe(true);
  });
  it("adds hair volume above the bare scalp", () => {
    const plain = humanoid(4000, mulberry32(7), bust);
    const liked = build(7);
    const maxY = (p: Float32Array) => {
      let m = -Infinity;
      for (let i = 1; i < p.length; i += 3) m = Math.max(m, p[i] ?? -Infinity);
      return m;
    };
    expect(maxY(liked.positions)).toBeGreaterThan(maxY(plain.positions));
  });
});
