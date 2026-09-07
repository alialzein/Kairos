import { Color, Vector3 } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { createContourUniforms } from "./ContourMaterial";
import { sceneConfig } from "./sceneConfig";

/** Phase 10.3 — the bead uniforms reach the shader from config, and the toggle is a 1/0 float
 *  so `?set=contours.beads.enabled:false` flips it without rebuilding the material graph. */
describe("createContourUniforms — beads", () => {
  it("exposes the configured bead frequency and floor, enabled by default", () => {
    const u = createContourUniforms(sceneConfig);
    expect(u.beadFrequency.value).toBe(140);
    expect(u.beadMin.value).toBe(0.35);
    expect(u.beadOn.value).toBe(1);
  });

  it("turns beadOn to 0 when contours.beads.enabled is false", () => {
    const u = createContourUniforms({
      ...sceneConfig,
      contours: {
        ...sceneConfig.contours,
        beads: { ...sceneConfig.contours.beads, enabled: false },
      },
    });
    expect(u.beadOn.value).toBe(0);
  });
});

/** Phase 12.4 — the white-hot centre reaches the shader from config: the inner fraction of the
 *  core radius, and `palette.coreHot` as a linear-rgb Vector3 (the same conversion as the other
 *  colour uniforms). */
describe("createContourUniforms — hot core", () => {
  it("exposes the hot radius fraction and the hot colour", () => {
    const u = createContourUniforms(sceneConfig);
    expect(u.coreRadius.value).toBe(0.5);
    expect(u.hotRadius.value).toBe(0.4);
    const hot = new Color(sceneConfig.palette.coreHot);
    expect(u.hotColor.value).toEqual(new Vector3(hot.r, hot.g, hot.b));
  });
});
