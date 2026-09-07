import { describe, expect, it } from "vitest";
import { verticalFov } from "./framing";

describe("verticalFov (round 2 item 1: fixed 54° horizontal FOV)", () => {
  it("reproduces the round-1 vertical fov of 32° at 16:9", () => {
    expect(verticalFov(54, 16 / 9)).toBeCloseTo(32.0, 0);
  });
  it("equals the horizontal fov at 1:1 and widens on narrow viewports", () => {
    expect(verticalFov(54, 1)).toBeCloseTo(54, 9);
    expect(verticalFov(54, 0.5)).toBeGreaterThan(90);
    expect(verticalFov(54, 0.5)).toBeLessThan(180);
  });
  it("keeps the same horizontal extent at every aspect", () => {
    for (const aspect of [0.5, 1, 16 / 9, 3]) {
      const half = (verticalFov(54, aspect) * Math.PI) / 360;
      expect(Math.tan(half) * aspect).toBeCloseTo(Math.tan((27 * Math.PI) / 180), 9);
    }
  });
});
