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
