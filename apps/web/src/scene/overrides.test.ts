import { describe, expect, it } from "vitest";
import { applyOverrides } from "./overrides";

describe("applyOverrides", () => {
  const make = () => ({
    contours: { frequency: 90, lineWidth: 0.1 },
    palette: { line: "#35C8FF" },
    layers: { post: true },
    core: { center: [0, 1.5, 0.45] },
  });

  it("sets numbers, strings and booleans by dotted path", () => {
    const c = make();
    const applied = applyOverrides(
      c,
      "contours.frequency:40, palette.line:#ffffff ,layers.post:false",
    );
    expect(c.contours.frequency).toBe(40);
    expect(c.palette.line).toBe("#ffffff");
    expect(c.layers.post).toBe(false);
    expect(applied).toEqual(["contours.frequency=40", "palette.line=#ffffff", "layers.post=false"]);
  });
  it("sets numeric vectors with | separators when the length matches", () => {
    const c = make();
    expect(applyOverrides(c, "core.center:0|1.3|0.5")).toEqual(["core.center=0,1.3,0.5"]);
    expect(c.core.center).toEqual([0, 1.3, 0.5]);
    expect(applyOverrides(c, "core.center:1|2")).toEqual([]);
    expect(applyOverrides(c, "core.center:a|b|c")).toEqual([]);
  });
  it("ignores unknown paths, non-numeric values for numbers, objects and empty specs", () => {
    const c = make();
    expect(
      applyOverrides(c, "contours.nope:1,zzz.frequency:2,contours.frequency:abc,core:1"),
    ).toEqual([]);
    expect(c).toEqual(make());
    expect(applyOverrides(c, undefined)).toEqual([]);
    expect(applyOverrides(c, "")).toEqual([]);
    expect(applyOverrides(c, "novalue")).toEqual([]);
  });
});
