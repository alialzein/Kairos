import { describe, expect, it } from "vitest";
import { LAYER_PHASE, layersFromQuery } from "./layers";
import { LAYER_NAMES, sceneConfig } from "./sceneConfig";

describe("layersFromQuery", () => {
  it("defaults to the config flags", () => {
    expect(layersFromQuery({})).toEqual(sceneConfig.layers);
  });
  it("phase=N enables exactly the layers introduced up to N", () => {
    const l = layersFromQuery({ phase: "2" });
    expect(l).toMatchObject({ stars: true, bust: true, contours: false, core: false, post: false });
    expect(layersFromQuery({ phase: "0" })).toEqual(
      Object.fromEntries(LAYER_NAMES.map((n) => [n, false])),
    );
    expect(layersFromQuery({ phase: "8" }).shell).toBe(false); // Phase 10
    expect(layersFromQuery({ phase: "10" }).dust).toBe(false); // Phase 11.4
    expect(layersFromQuery({ phase: "11" })).toEqual(
      Object.fromEntries(LAYER_NAMES.map((n) => [n, true])),
    );
  });
  it("only= keeps just the listed layers, off= removes layers, unknown names are ignored", () => {
    expect(layersFromQuery({ only: "bust,contours,nope" })).toMatchObject({
      bust: true,
      contours: true,
      stars: false,
      post: false,
    });
    expect(layersFromQuery({ off: "post, hud ,zzz" })).toMatchObject({
      post: false,
      hud: false,
      bust: true,
    });
    expect(layersFromQuery({ phase: "8", off: "bust" }).bust).toBe(false);
  });
  it("applies phase, then only, then off, in that order", () => {
    expect(layersFromQuery({ phase: "8", only: "bust,post", off: "post" })).toEqual({
      ...Object.fromEntries(LAYER_NAMES.map((n) => [n, false])),
      bust: true,
    });
  });
  it("every layer has a phase", () => {
    for (const n of LAYER_NAMES) expect(LAYER_PHASE[n]).toBeGreaterThan(0);
  });
});
