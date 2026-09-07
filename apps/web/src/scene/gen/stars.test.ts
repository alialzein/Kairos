import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/avatar/sim/random";
import { starPositions } from "./stars";

const opts = {
  count: 400,
  radius: 60,
  depth: 20,
  fovDeg: 32,
  aspect: 2.2,
  camera: [0, 1, 5.5] as const,
};

describe("starPositions", () => {
  it("places every star on the shell radius..radius+depth from the camera, in front of it", () => {
    const p = starPositions(opts, mulberry32(1));
    expect(p.length).toBe(400 * 3);
    for (let i = 0; i < 400; i++) {
      const dx = (p[i * 3] ?? 0) - 0;
      const dy = (p[i * 3 + 1] ?? 0) - 1;
      const dz = (p[i * 3 + 2] ?? 0) - 5.5;
      const d = Math.hypot(dx, dy, dz);
      expect(d).toBeGreaterThanOrEqual(60 - 1e-9);
      expect(d).toBeLessThanOrEqual(80 + 1e-9);
      expect(dz).toBeLessThan(0);
    }
  });
  it("stays inside the (widened) view cone", () => {
    const p = starPositions({ ...opts, margin: 1 }, mulberry32(2));
    const tanH = Math.tan((32 * Math.PI) / 360);
    for (let i = 0; i < 400; i++) {
      const dx = p[i * 3] ?? 0;
      const dy = (p[i * 3 + 1] ?? 0) - 1;
      const dz = 5.5 - (p[i * 3 + 2] ?? 0);
      expect(Math.abs(dy) / dz).toBeLessThanOrEqual(tanH + 1e-9);
      expect(Math.abs(dx) / dz).toBeLessThanOrEqual(tanH * 2.2 + 1e-9);
    }
  });
  it("is deterministic per seed and differs across seeds", () => {
    const a = starPositions(opts, mulberry32(7));
    const b = starPositions(opts, mulberry32(7));
    const c = starPositions(opts, mulberry32(8));
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });
});
