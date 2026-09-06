import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sim/random";
import {
  CHEST_NODE,
  chestNode,
  mergeTrees,
  NODE_R,
  RIDGE_VEINS,
  ridgeClearance,
  ridgeVeins,
  spineTree,
  THROAT,
  type VeinTree,
} from "./veins";
import { waveHeight } from "../sim/targets/waves";

/** every recorded branch start coincides (xy) with some segment endpoint of the tree */
function connected(t: VeinTree): boolean {
  for (let b = 0; b < t.branchStarts.length; b += 3) {
    const bx = t.branchStarts[b] ?? 0,
      by = t.branchStarts[b + 1] ?? 0;
    let hit = false;
    for (let s = 0; s < t.segments.length && !hit; s += 3) {
      if (
        Math.abs((t.segments[s] ?? 0) - bx) < 1e-6 &&
        Math.abs((t.segments[s + 1] ?? 0) - by) < 1e-6
      )
        hit = true;
    }
    if (!hit) return false;
  }
  return true;
}

describe("spineTree", () => {
  const t = spineTree(mulberry32(3));
  it("is connected, starts at the throat, stays in front of the torso, deterministic", () => {
    expect(t.segT.length).toBeGreaterThan(20);
    expect(t.branchStarts.length / 3).toBeGreaterThan(3);
    expect(connected(t)).toBe(true);
    // branches are emitted depth-first (children before their parent): find the trunk's start
    const trunk = Array.from(t.segGen).indexOf(0);
    expect(t.segments[trunk * 6]).toBeCloseTo(THROAT[0]);
    expect(t.segments[trunk * 6 + 1]).toBeCloseTo(THROAT[1]);
    for (let s = 0; s < t.segments.length; s += 3) {
      expect(Math.abs(t.segments[s] ?? 0)).toBeLessThan(0.3);
      expect(t.segments[s + 1] ?? 0).toBeLessThan(THROAT[1] + 0.01);
      expect(t.segments[s + 1] ?? 0).toBeGreaterThan(CHEST_NODE[1] - 0.2);
      expect(t.segments[s + 2] ?? 0).toBeGreaterThanOrEqual(0.28);
      expect(t.segments[s + 2] ?? 0).toBeLessThanOrEqual(0.32);
    }
    for (let i = 0; i < t.segT.length; i++) {
      expect(t.segT[i]).toBeGreaterThanOrEqual(0);
      expect(t.segT[i]).toBeLessThanOrEqual(1);
    }
    expect(Array.from(spineTree(mulberry32(3)).segments)).toEqual(Array.from(t.segments));
  });
});

describe("chestNode", () => {
  it("is a six-fold node: spoke tips mirror in x, sub-branches attach to spokes", () => {
    const t = chestNode(mulberry32(1));
    expect(connected(t)).toBe(true);
    // spoke tips: segments of gen 0 whose end is 0.09 from the centre
    const tips: [number, number][] = [];
    for (let s = 0; s < t.segT.length; s++) {
      if ((t.segGen[s] ?? 0) !== 0) continue;
      const ex = (t.segments[s * 6 + 3] ?? 0) - CHEST_NODE[0];
      const ey = (t.segments[s * 6 + 4] ?? 0) - CHEST_NODE[1];
      if (Math.abs(Math.hypot(ex, ey) - NODE_R) < 1e-6) tips.push([ex, ey]);
    }
    expect(tips.length).toBe(6);
    for (const [x, y] of tips) {
      expect(tips.some(([mx, my]) => Math.abs(mx + x) < 1e-6 && Math.abs(my - y) < 1e-6)).toBe(
        true,
      );
    }
  });
  it("mergeTrees concatenates segment sets and attributes", () => {
    const a = spineTree(mulberry32(5));
    const b = chestNode(mulberry32(6));
    const m = mergeTrees([a, b]);
    expect(m.segT.length).toBe(a.segT.length + b.segT.length);
    expect(m.segments.length).toBe(a.segments.length + b.segments.length);
    expect(m.segGen[a.segT.length]).toBe(b.segGen[0]);
  });
});

describe("ridgeVeins", () => {
  it("rides the mountain heightfield in the far field, deterministic", () => {
    const t = ridgeVeins(mulberry32(8));
    expect(t.segT.length).toBeGreaterThan(RIDGE_VEINS * 3);
    const gens = new Set<number>();
    for (let s = 0; s < t.segT.length; s++) {
      gens.add(t.segGen[s] ?? -1);
      for (const off of [0, 3]) {
        const x = t.segments[s * 6 + off] ?? 0;
        const y = t.segments[s * 6 + off + 1] ?? 0;
        const z = t.segments[s * 6 + off + 2] ?? 0;
        expect(Math.abs(y - waveHeight(x, z))).toBeLessThan(0.03);
        expect(z).toBeLessThanOrEqual(-0.5);
        expect(Math.abs(x)).toBeLessThanOrEqual(3.3);
        expect(Math.abs(x)).toBeGreaterThanOrEqual(ridgeClearance(z) - 1e-6);
      }
    }
    expect(gens.size).toBeGreaterThanOrEqual(RIDGE_VEINS - 2);
    expect(Array.from(ridgeVeins(mulberry32(8)).segments)).toEqual(Array.from(t.segments));
  });
});
