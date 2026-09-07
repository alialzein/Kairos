import { SphereGeometry } from "three";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/avatar/sim/random";
import { sampleShell } from "./shell";

const opts = {
  count: 400,
  push: [0.01, 0.04] as [number, number],
  size: [0.01, 0.025] as [number, number],
};

describe("sampleShell", () => {
  const sphere = new SphereGeometry(1, 32, 16);
  const s = sampleShell(sphere, opts, mulberry32(13));

  it("returns count points with matching array lengths", () => {
    expect(s.count).toBe(opts.count);
    expect(s.positions).toHaveLength(opts.count * 3);
    expect(s.normals).toHaveLength(opts.count * 3);
    expect(s.sizes).toHaveLength(opts.count);
  });

  it("pushes every point off the surface along its normal, inside [push[0], push[1]]", () => {
    // the sphere is faceted, so a sampled point sits up to ~0.005 inside radius 1: tolerance 0.02
    for (let i = 0; i < s.count; i++) {
      const r = Math.hypot(s.positions[i * 3]!, s.positions[i * 3 + 1]!, s.positions[i * 3 + 2]!);
      expect(r - 1).toBeGreaterThanOrEqual(opts.push[0] - 0.02);
      expect(r - 1).toBeLessThanOrEqual(opts.push[1] + 0.02);
    }
  });

  it("stores unit normals pointing along the radius", () => {
    for (let i = 0; i < s.count; i++) {
      const n = [s.normals[i * 3]!, s.normals[i * 3 + 1]!, s.normals[i * 3 + 2]!];
      expect(Math.hypot(...n)).toBeCloseTo(1, 5);
      const p = [s.positions[i * 3]!, s.positions[i * 3 + 1]!, s.positions[i * 3 + 2]!];
      const len = Math.hypot(...p);
      const dot = (n[0]! * p[0]! + n[1]! * p[1]! + n[2]! * p[2]!) / len;
      expect(dot).toBeGreaterThan(Math.cos((10 * Math.PI) / 180));
    }
  });

  it("draws sizes inside the requested range and spreads them over it", () => {
    let min = Infinity;
    let max = -Infinity;
    for (const v of s.sizes) {
      expect(v).toBeGreaterThanOrEqual(opts.size[0]);
      expect(v).toBeLessThanOrEqual(opts.size[1]);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(max - min).toBeGreaterThan((opts.size[1] - opts.size[0]) * 0.8);
  });

  it("is deterministic for a seed and differs for another", () => {
    expect(sampleShell(sphere, opts, mulberry32(13)).positions).toEqual(s.positions);
    expect(sampleShell(sphere, opts, mulberry32(13)).sizes).toEqual(s.sizes);
    expect(sampleShell(sphere, opts, mulberry32(14)).positions).not.toEqual(s.positions);
  });
});
