"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { float, length, mrt, oneMinus, output, pass, screenUV, smoothstep, vec4 } from "three/tsl";
import {
  BlendMode,
  HalfFloatType,
  MaterialBlending,
  RenderPipeline,
  type WebGPURenderer,
} from "three/webgpu";
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
 *
 * Phase 12.1 (Ali: "EffectComposer frameBufferType HalfFloat, explicit"). Where the HDR range
 * survives, read from three 0.185.4:
 * - Scene pass: `new RenderTarget(w, h, { type: HalfFloatType, ...options })`
 *   (PassNode.js:246), and `setup()` then re-asserts
 *   `this.renderTarget.texture.type = renderer.getOutputBufferType()` (PassNode.js:768) — so the
 *   pass option below states the intent, and the renderer's `outputBufferType: HalfFloatType`
 *   (SceneCanvas.makeRenderer) is the value that actually sticks. Both are set explicitly.
 * - Bloom: BloomNode allocates its own bright-pass and 5×2 blur targets, all
 *   `new RenderTarget(1, 1, { depthBuffer: false, type: HalfFloatType })`
 *   (BloomNode.js:155/163/170) — half-float, not configurable, nothing to change.
 * - Output: RenderPipeline.render() wraps `outputNode` in `renderOutput(node, renderer.toneMapping,
 *   renderer.outputColorSpace)` (RenderPipeline.js:207). `flat` keeps toneMapping = NoToneMapping,
 *   so nothing compresses the highlights — do NOT add tone mapping here. RenderOutputNode clamps
 *   alpha only (RenderOutputNode.d 'clamp alpha') and `sRGBTransferOETF` has no clamp either, so
 *   values > 1 stay > 1 through the whole chain and only clip when the frame is written into the
 *   8-bit-per-channel canvas swapchain — i.e. the display clips per channel, which is what turns an
 *   over-boosted blue-cyan into green-cyan. Everything before that write (bloom's bright pass
 *   included) sees the true HDR value.
 *
 * Phase 14.1 — SELECTIVE BLOOM (`post.selectiveBloom`, default on). Ali specced it in pmndrs
 * terms (`Selection`/`Select` + `SelectiveBloom`), which cannot run on this stack: pmndrs'
 * EffectComposer is WebGL-only and its SelectiveBloom re-renders the selection into a second
 * WebGLRenderTarget — neither exists on the WebGPURenderer path. three's equivalent is a
 * multiple-render-target mask on the scene pass, so this is that:
 * - `scenePass.setMRT(mrt({ output, bloomSrc: output }))` gives the pass a SECOND colour
 *   attachment. `output` is the TSL property node NodeMaterial assigns the material's final
 *   colour to (NodeMaterial.js:541), so by default every material writes the same colour to both
 *   attachments and `bloomSrc` is a plain copy of the frame.
 * - Bloom then reads `bloomSrc` instead of `output`; the composite is still `output + bloom`, at
 *   the same strength/radius/threshold/smoothing. Anything that writes black into `bloomSrc`
 *   drops out of the glow without changing how it looks in the frame.
 * - `ContourMaterial` is the only exclusion: it sets `material.mrtNode = mrt({ bloomSrc: black })`.
 *   NodeMaterial MERGES that with the pass MRT — `resultNode = mrt.merge(materialMRT)`
 *   (NodeMaterial.js:572) over `{ ...this.outputNodes, ...mrtNode.outputNodes }`
 *   (MRTNode.js:151) — so the material keeps the pass's `output` and overrides only `bloomSrc`.
 *   The shell, halo, core, neck, rings, landscape, dust and plume set no `mrtNode` and stay in
 *   the selection.
 * - Blending is NOT inherited per attachment. Both backends look the blend state up per texture
 *   NAME through `mrt.getBlendMode(texture.name)` (WebGPUPipelineUtils.js:147,
 *   WebGLState.js:297), and `MRTNode.blendModes` seeds only `{ output: MaterialBlending }`
 *   (MRTNode.js:78) with `getBlendMode()` falling back to `_noBlending` — which WebGPU emits as
 *   `blend: undefined` and WebGL as `blendFunc(ONE, ZERO)`, i.e. an overwrite. Left alone, the
 *   additive sprites would REPLACE `bloomSrc` instead of adding into it, so
 *   `setBlendMode("bloomSrc", new BlendMode(MaterialBlending))` below makes the second attachment
 *   follow each material's own blending and the additive layers accumulate there exactly as they
 *   do in `output`.
 * - Both attachments are half-float: `PassNode.getTexture(name)` for an unknown name CLONES
 *   `renderTarget.texture` (PassNode.js:582) — the target built above with `type: HalfFloatType`
 *   — and pushes the clone into `renderTarget.textures`, and `RenderTarget.setSize()` resizes
 *   every entry of that array (RenderTarget.js:295). Nothing else has to be configured.
 * - `selectiveBloom: false` restores the exact single-attachment chain (no `setMRT`, bloom reads
 *   `output`) for an A/B on the bench: `?set=post.selectiveBloom:false`. ContourMaterial reads
 *   the same flag and leaves `mrtNode` null in that mode — a material MRT holding only `bloomSrc`
 *   with no attachment of that name would resolve to an EMPTY output struct, because
 *   `MRTNode.setup()` skips every name `getTextureIndex()` cannot find in the target's textures.
 */
export function Effects() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const built = useMemo(() => {
    const { post } = sceneConfig;
    const pipeline = new RenderPipeline(gl);
    // explicit half-float scene buffer (Ali's "frameBufferType HalfFloat"); see the header note on
    // PassNode.setup() re-asserting this from the renderer's outputBufferType
    const scenePass = pass(scene, camera, { type: HalfFloatType });
    // Phase 14.1: the bloom-source attachment; see the header for the merge and blending rules
    if (post.selectiveBloom) {
      const sceneMrt = mrt({ output, bloomSrc: output });
      sceneMrt.setBlendMode("bloomSrc", new BlendMode(MaterialBlending));
      scenePass.setMRT(sceneMrt);
    }
    const color = scenePass.getTextureNode("output");
    const bloomSource = post.selectiveBloom ? scenePass.getTextureNode("bloomSrc") : color;
    const bloomNode = bloom(bloomSource, post.bloomStrength, post.bloomRadius, post.bloomThreshold);
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
