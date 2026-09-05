import { describe, expect, it } from "vitest";
import { Morph } from "./morph";

describe("Morph", () => {
  it("starts settled on the initial shape and tweens to the next over the duration", () => {
    const m = new Morph(2);
    expect(m.shapeA).toBe(2);
    expect(m.t).toBe(1);
    m.start(1, 1.0, "linear");
    expect(m.shapeA).toBe(2);
    expect(m.shapeB).toBe(1);
    m.update(0.25);
    expect(m.eased).toBeCloseTo(0.25);
    m.update(1);
    expect(m.t).toBe(1);
    expect(m.eased).toBe(1);
  });
  it("retargeting mid-way continues from the previous target", () => {
    const m = new Morph(0);
    m.start(1, 1, "linear");
    m.update(0.5);
    m.start(3, 1, "linear");
    expect(m.shapeA).toBe(1);
    expect(m.shapeB).toBe(3);
    expect(m.t).toBe(0);
  });
});
