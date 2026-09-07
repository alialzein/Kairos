"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { float, length, oneMinus, pass, screenUV, smoothstep, vec4 } from "three/tsl";
import { RenderPipeline, type WebGPURenderer } from "three/webgpu";
import { sceneConfig } from "./sceneConfig";

/**
 * Phase 8 — post-processing (docs/plans/scene-plan.md Phase 8): bloom + vignette, nothing else.
 * The @react-three/postprocessing composer is WebGL-only, so this is three's own RenderPipeline
 * (the pattern of avatar/post/pipeline.ts): scene pass → BloomNode → vignette → output.
 *
 * Semantics that differ from pmndrs and are mapped in sceneConfig.post:
 * - `bloomStrength` is three's BloomNode.strength (five mip blurs summed with a fixed weight
 *   total of 3.0, then added linearly), not pmndrs `intensity` (normalised chain, screen blend):
 *   the plan's 1.3 ≈ strength 0.43 as the energy-equivalent start.
 * - `bloomThreshold`/`bloomSmoothing` port 1:1 (smoothstep(threshold, threshold + width) on
 *   linear luminance). `bloomResolutionScale` 1 thresholds per full-resolution pixel like
 *   pmndrs (three's default 0.5 box-averages the sub-pixel contour lines under the threshold).
 * - Vignette is pmndrs' default technique in ascending-edge form; it multiplies colour only and
 *   pins alpha to 1, otherwise a premultiplied canvas fades the corners to the page colour.
 * The scene pass renders linear (tone mapping is off: `flat` on the Canvas), and bloom reads
 * those values before the sRGB output transform, so `toneMapped` flags are not needed.
 */
export function Effects() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const built = useMemo(() => {
    const { post } = sceneConfig;
    const pipeline = new RenderPipeline(gl);
    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode("output");
    const bloomNode = bloom(color, post.bloomStrength, post.bloomRadius, post.bloomThreshold);
    bloomNode.smoothWidth.value = post.bloomSmoothing;
    bloomNode.setResolutionScale(post.bloomResolutionScale);
    // widen away from the TextureNode the pass returns: the chain below only needs vec4 arithmetic
    // (@types/three 0.185.4 types getTextureNode() too narrowly; same cast as avatar/post/pipeline.ts)
    type ColorNode = ReturnType<(typeof color)["add"]>;
    const out = (color as unknown as ColorNode).add(bloomNode);
    const d = float(length(screenUV.sub(0.5)));
    const vig = oneMinus(
      smoothstep(
        post.vignetteOffset * 0.799,
        0.8,
        d.mul(post.vignetteDarkness + post.vignetteOffset),
      ),
    );
    pipeline.outputNode = vec4(out.rgb.mul(vig), 1);
    return { pipeline, scenePass, bloomNode };
  }, [gl, scene, camera]);
  useEffect(
    () => () => {
      // the pass and bloom own render targets that RenderPipeline.dispose() does not reach
      built.bloomNode.dispose();
      built.scenePass.dispose();
      built.pipeline.dispose();
    },
    [built],
  );
  // priority 1: R3F stops auto-rendering; the pipeline draws the frame
  useFrame(() => built.pipeline.render(), 1);
  return null;
}
