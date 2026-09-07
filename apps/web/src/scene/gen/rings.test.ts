import { describe, expect, it } from "vitest";
import { sceneConfig } from "../sceneConfig";
import { ringSpecs } from "./rings";

describe("ringSpecs", () => {
  it("steps outward from innerRadius and fades from opacityFrom to opacityTo", () => {
    const r = ringSpecs(sceneConfig.rings);
    expect(r.length).toBe(9);
    expect(r[0]).toEqual({ radius: 0.9, opacity: sceneConfig.rings.opacityFrom });
    expect(r[8]?.radius).toBeCloseTo(0.9 + 8 * 0.25, 9);
    expect(r[8]?.opacity).toBeCloseTo(sceneConfig.rings.opacityTo, 9);
    for (let i = 1; i < r.length; i++) {
      expect((r[i]?.radius ?? 0) - (r[i - 1]?.radius ?? 0)).toBeCloseTo(0.25, 9);
      expect(r[i]?.opacity ?? 0).toBeLessThan(r[i - 1]?.opacity ?? 0);
    }
  });
  it("handles a single ring and zero rings", () => {
    expect(ringSpecs({ ...sceneConfig.rings, count: 1 })).toEqual([
      { radius: 0.9, opacity: sceneConfig.rings.opacityFrom },
    ]);
    expect(ringSpecs({ ...sceneConfig.rings, count: 0 })).toEqual([]);
  });
});
