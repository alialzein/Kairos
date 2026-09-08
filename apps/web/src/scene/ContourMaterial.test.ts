import { Color, Vector3 } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { createContourMaterial, createContourUniforms } from "./ContourMaterial";
import { sceneConfig } from "./sceneConfig";

/** Phase 10.3 — the bead uniforms reach the shader from config, and the toggle is a 1/0 float
 *  so `?set=contours.beads.enabled:false` flips it without rebuilding the material graph. */
describe("createContourUniforms — beads", () => {
  it("exposes the configured bead frequency and floor, enabled by default", () => {
    const u = createContourUniforms(sceneConfig);
    expect(u.beadFrequency.value).toBe(sceneConfig.contours.beads.frequency);
    expect(u.beadMin.value).toBe(sceneConfig.contours.beads.min);
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
    expect(u.hotRadius.value).toBe(sceneConfig.core.hot.radius);
    const hot = new Color(sceneConfig.palette.coreHot);
    expect(u.hotColor.value).toEqual(new Vector3(hot.r, hot.g, hot.b));
  });
});

/** Phase 14.1 — selective bloom. The contour mesh leaves the bloom selection by writing black
 *  into the scene pass's `bloomSrc` attachment, which is an `mrtNode` on the material (the pass
 *  MRT merges it in, Effects.tsx). With `post.selectiveBloom` off there is no such attachment,
 *  so the node must not be attached at all. */
describe("createContourMaterial — bloom exclusion", () => {
  it("attaches an MRT node writing the bloom-source mask", () => {
    const { material } = createContourMaterial(sceneConfig);
    expect(sceneConfig.post.selectiveBloom).toBe(true);
    expect(material.mrtNode).not.toBeNull();
    expect(material.mrtNode?.has("bloomSrc")).toBe(true);
    // only bloomSrc is overridden: `output` comes from the pass MRT through MRTNode.merge()
    expect(material.mrtNode?.has("output")).toBe(false);
  });

  it("leaves mrtNode null when post.selectiveBloom is false", () => {
    const { material } = createContourMaterial({
      ...sceneConfig,
      post: { ...sceneConfig.post, selectiveBloom: false },
    });
    expect(material.mrtNode).toBeNull();
  });
});
