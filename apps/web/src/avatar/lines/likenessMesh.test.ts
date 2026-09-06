import { describe, expect, it } from "vitest";
import tiny from "../sim/__fixtures__/bust-tiny.json";
import { boundsOf } from "../sim/sampler";
import { GLASSES } from "../sim/targets/likeness";
import { appendPolylines, glassesPolylines, liftMesh } from "./likenessMesh";
import { sliceMesh } from "./slice";

const bust = {
  positions: new Float32Array(tiny.positions),
  indices: new Uint32Array(tiny.indices),
  bounds: boundsOf(new Float32Array(tiny.positions)),
};

describe("liftMesh", () => {
  it("raises only scalp vertices and leaves the face/torso bitwise identical", () => {
    const lifted = liftMesh(bust);
    expect(lifted.positions.length).toBe(bust.positions.length);
    let moved = 0;
    let untouched = 0;
    for (let i = 0; i < bust.positions.length; i += 3) {
      const y = bust.positions[i + 1] ?? 0;
      const z = bust.positions[i + 2] ?? 0;
      const same =
        lifted.positions[i] === bust.positions[i] &&
        lifted.positions[i + 1] === bust.positions[i + 1] &&
        lifted.positions[i + 2] === bust.positions[i + 2];
      const scalp = y > 0.55 && (z < 0.18 || y > 0.7);
      if (scalp) {
        expect((lifted.positions[i + 1] ?? 0) >= y).toBe(true);
        moved++;
      } else {
        expect(same).toBe(true);
        untouched++;
      }
    }
    expect(moved).toBeGreaterThan(0);
    expect(untouched).toBeGreaterThan(0);
    expect(lifted.bounds.max[1]).toBeGreaterThan(bust.bounds.max[1]);
    expect(liftMesh(bust).positions).toEqual(lifted.positions);
  });
});

describe("glassesPolylines + appendPolylines", () => {
  it("adds two closed rims on the rim plane plus bridge and temples", () => {
    const lines = glassesPolylines();
    expect(lines.filter((l) => l.closed).length).toBe(2);
    for (const l of lines.filter((l) => l.closed)) {
      for (let i = 0; i < l.points.length; i += 3) {
        expect(Math.abs((l.points[i + 2] ?? 0) - GLASSES.z)).toBeLessThan(1e-6);
        expect(Math.abs((l.points[i + 1] ?? 0) - GLASSES.cy)).toBeLessThanOrEqual(GLASSES.h + 1e-6);
      }
    }
    const base = sliceMesh(bust.positions, bust.indices, {
      count: 10,
      yMin: -0.5,
      yMax: 0.9,
      spacing: 0.03,
    });
    const out = appendPolylines(base, lines);
    let extra = 0;
    for (const l of lines) extra += l.closed ? l.points.length / 3 : l.points.length / 3 - 1;
    expect(out.segments.length).toBe(base.segments.length + extra * 6);
    expect(out.segSlice.length).toBe(base.segSlice.length + extra);
    expect(out.segSlice[base.segSlice.length]).toBe(-1);
    expect(Array.from(out.segments.slice(0, 12))).toEqual(Array.from(base.segments.slice(0, 12)));
  });
});
