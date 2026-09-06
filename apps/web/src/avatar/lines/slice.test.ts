import { describe, expect, it } from "vitest";
import tiny from "../sim/__fixtures__/bust-tiny.json";
import { sliceMesh } from "./slice";

const positions = new Float32Array(tiny.positions);
const indices = new Uint32Array(tiny.indices);

describe("sliceMesh", () => {
  const out = sliceMesh(positions, indices, { count: 24, yMin: -0.55, yMax: 0.9, spacing: 0.03 });

  it("produces closed loops whose slice heights rise monotonically", () => {
    expect(out.loops.length).toBeGreaterThan(10);
    let lastY = -Infinity;
    for (const loop of out.loops) {
      expect(loop.count).toBeGreaterThanOrEqual(8);
      expect(loop.y).toBeGreaterThanOrEqual(lastY);
      lastY = loop.y;
      // every vertex of the loop sits on its plane
      for (let k = 0; k < loop.count; k++) {
        const y = out.vertices[(loop.start + k) * 3 + 1] ?? NaN;
        expect(Math.abs(y - loop.y)).toBeLessThan(1e-4);
      }
    }
  });

  it("resamples loops to roughly even spacing; closed loops wrap, open chains do not", () => {
    let expectedSegs = 0;
    for (const loop of out.loops) expectedSegs += loop.closed ? loop.count : loop.count - 1;
    expect(out.segments.length).toBe(expectedSegs * 6);
    expect(out.loops.some((l) => l.closed)).toBe(true);
    const loop = out.loops.find((l) => l.closed)!;
    for (let k = 0; k < loop.count; k++) {
      const a = (loop.start + k) * 3;
      const b = (loop.start + ((k + 1) % loop.count)) * 3;
      const d = Math.hypot(
        (out.vertices[a] ?? 0) - (out.vertices[b] ?? 0),
        (out.vertices[a + 2] ?? 0) - (out.vertices[b + 2] ?? 0),
      );
      expect(d).toBeGreaterThan(0.03 * 0.5);
      expect(d).toBeLessThan(0.03 * 1.6);
    }
  });

  it("carries per-segment attributes aligned with the segment buffer", () => {
    const segs = out.segments.length / 6;
    expect(out.segSlice.length).toBe(segs);
    expect(out.segT.length).toBe(segs);
    expect(out.segX.length).toBe(segs);
    for (let s = 0; s < segs; s++) {
      expect(out.segT[s]).toBeGreaterThanOrEqual(0);
      expect(out.segT[s]).toBeLessThanOrEqual(1);
      expect(Number.isFinite(out.segX[s])).toBe(true);
    }
  });

  it("keeps open chains from a mesh boundary as polylines", () => {
    // a single open strip: two triangles forming a quad wall x∈[0,1], y∈[-1,1], z=0
    const wall = sliceMesh(
      new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]),
      new Uint32Array([0, 1, 2, 0, 2, 3]),
      { count: 3, yMin: -0.5, yMax: 0.5, spacing: 0.1 },
    );
    expect(wall.loops.length).toBe(3);
    for (const l of wall.loops) {
      expect(l.closed).toBe(false);
      expect(l.count).toBeGreaterThanOrEqual(8);
    }
    expect(wall.segments.length).toBe(wall.loops.reduce((n, l) => n + l.count - 1, 0) * 6);
  });

  it("is deterministic and never throws on degenerate input", () => {
    const again = sliceMesh(positions, indices, {
      count: 24,
      yMin: -0.55,
      yMax: 0.9,
      spacing: 0.03,
    });
    expect(Array.from(again.segments.slice(0, 60))).toEqual(Array.from(out.segments.slice(0, 60)));
    const tri = sliceMesh(
      new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
      new Uint32Array([0, 1, 2]),
      {
        count: 5,
        yMin: -1,
        yMax: 1,
        spacing: 0.1,
      },
    );
    expect(tri.loops.length).toBe(0);
    expect(tri.segments.length).toBe(0);
  });
});
