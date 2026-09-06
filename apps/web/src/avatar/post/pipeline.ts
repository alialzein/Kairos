import { float, length, oneMinus, pass, screenUV, smoothstep, uniform, vec2 } from "three/tsl";
import { RenderPipeline, type Camera, type Scene, type WebGPURenderer } from "three/webgpu";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { chromaticAberration } from "three/addons/tsl/display/ChromaticAberrationNode.js";
import type { BloomParams } from "./params";

export interface PostPipeline {
  render(): void;
  setAberration(v: number): void;
  setBloom(p: BloomParams): void;
  dispose(): void;
}

export function createPipeline(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  opts: { bloom: BloomParams | null; vignette?: number },
): PostPipeline {
  const pipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode("output");
  const uAberration = uniform(0);
  const uVignette = uniform(opts.vignette ?? 0.35);

  // widen away from the TextureNode the pass returns: the chain below only needs vec4 arithmetic
  type ColorNode = ReturnType<(typeof color)["add"]>;
  let out: ColorNode = color as unknown as ColorNode;
  let bloomNode: ReturnType<typeof bloom> | null = null;
  if (opts.bloom) {
    bloomNode = bloom(color, opts.bloom.strength, opts.bloom.radius, opts.bloom.threshold);
    out = color.add(bloomNode);
    // chromatic aberration only fires on WAKING (strength 0 otherwise); skipped entirely when
    // bloom is off so the Low tier keeps its single cheap pass. center must be explicit: three
    // 0.185.1's addon documents "null → screen center" but passes null into the shader call,
    // which crashes the node builder. The scale parameter and return type are bare `Node` in
    // @types/three 0.185.4 (same overload-narrowing gap as shapeCircle in sim/compute.ts).
    out = chromaticAberration(
      out,
      uAberration,
      vec2(0.5, 0.5),
      float(1.1),
    ) as unknown as typeof out;
  }
  const vig = oneMinus(smoothstep(0.55, 1.35, length(screenUV.sub(0.5)).mul(2)).mul(uVignette));
  pipeline.outputNode = out.mul(vig);

  return {
    render: () => pipeline.render(),
    setAberration: (v) => {
      uAberration.value = v * 0.6;
    },
    setBloom: (p) => {
      if (!bloomNode) return;
      bloomNode.strength.value = p.strength;
      bloomNode.radius.value = p.radius;
      bloomNode.threshold.value = p.threshold;
    },
    dispose: () => pipeline.dispose(),
  };
}
