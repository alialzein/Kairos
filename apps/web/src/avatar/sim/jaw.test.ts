import { describe, expect, it } from "vitest";
import { ANCHORS } from "./canonical";
import { JAW, jawOffset, jawOpen } from "./jaw";

describe("jaw", () => {
  it("opens with speech energy on a 9 rad/s cycle and never exceeds the energy", () => {
    expect(jawOpen(0, 0)).toBe(0);
    let max = 0;
    for (let t = 0; t < 2; t += 0.01) max = Math.max(max, jawOpen(t, 0.5));
    expect(max).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(max).toBeGreaterThan(0.45);
    expect(JAW.rate).toBe(9);
  });
  it("drops the chin below the mouth and leaves the forehead alone", () => {
    const [mx, my, mz] = ANCHORS.mouth;
    const chin = jawOffset(mx, my - 0.08, mz, 1);
    expect(chin[1]).toBeLessThan(-0.05);
    expect(chin[2]).toBeCloseTo(-chin[1] * JAW.forward);
    const forehead = jawOffset(mx, my + 0.3, mz, 1);
    expect(forehead).toEqual([0, 0, 0]);
    const far = jawOffset(mx + 0.5, my - 0.08, mz, 1);
    expect(far).toEqual([0, 0, 0]);
    expect(jawOffset(mx, my - 0.08, mz, 0)).toEqual([0, 0, 0]);
  });
});
