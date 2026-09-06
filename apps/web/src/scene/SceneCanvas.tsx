"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color } from "three";
import type { WebGPURenderer } from "three/webgpu";
import { FrameStats } from "@/avatar/telemetry/frametime";
import { Background } from "./Background";
import { Bust } from "./Bust";
import { Effects } from "./Effects";
import { FaceCore } from "./FaceCore";
import { Hud } from "./Hud";
import { Landscape } from "./Landscape";
import { NeckCircuit } from "./NeckCircuit";
import { Rings } from "./Rings";
import { Stars } from "./Stars";
import { sceneConfig, type Layers } from "./sceneConfig";
import { useSceneStore } from "./store";

export interface SceneCanvasProps {
  /** per-layer overrides on top of sceneConfig.layers; MUST be referentially stable (memo it) */
  layers?: Partial<Layers>;
  /** WebGL2 backend instead of WebGPU (bench `?webgl=1`) */
  forceWebGL?: boolean;
  className?: string;
  onReady?: () => void;
}

/** Sets the camera target once (the plan's `lookAt` on mount). R3F only applies position/fov
 *  from the `camera` prop and aims at the origin, so the tilt toward `lookAt` is done here. */
function SceneCamera() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const [x, y, z] = sceneConfig.camera.lookAt;
    camera.lookAt(x, y, z);
  }, [camera]);
  return null;
}

/** Marks the scene ready on its first frame and publishes p50/p95 frame times every 30 frames. */
function FrameTicker({ onReady }: { onReady?: () => void }) {
  const stats = useRef(new FrameStats());
  const last = useRef(0);
  const frame = useRef(0);
  const announced = useRef(false);
  useFrame(() => {
    const now = performance.now();
    if (last.current) stats.current.push(now - last.current);
    last.current = now;
    if (!announced.current) {
      announced.current = true;
      useSceneStore.getState().setReady(true);
      onReady?.();
    }
    // own counter: FrameStats.count pins at its 240-sample window, which is a multiple of 30
    if (++frame.current % 30 === 0) {
      const s = stats.current;
      useSceneStore.getState().setStats({ p50: s.p50, p95: s.p95, count: s.count });
    }
  });
  return null;
}

const gradient = `linear-gradient(180deg, ${sceneConfig.palette.bgTop} 0%, ${sceneConfig.palette.bgBottom} 100%)`;

/** one renderer per canvas element, shared by any re-entrant factory call (see makeRenderer) */
const inflight = new WeakMap<HTMLCanvasElement, Promise<WebGPURenderer>>();

/**
 * The "Neural Bust" scene (docs/plans/scene-plan.md): the plan's component tree inside one R3F
 * Canvas, each child gated by a layer flag, plus the DOM HUD beside it.
 *
 * Canvas-isolation rule (docs/plans/phase-b5-ledger.md, Task 7): with three 0.185.1's async WebGPU
 * init, a re-render of this component while the renderer initialises makes R3F run the `gl`
 * factory twice and the scene goes black. So nothing here subscribes to a store or holds state;
 * the factory is a stable callback and the `layers` prop must be memoized by the caller.
 */
export function SceneCanvas({
  layers: overrides,
  forceWebGL,
  className,
  onReady,
}: SceneCanvasProps) {
  const layers = useMemo<Layers>(() => ({ ...sceneConfig.layers, ...overrides }), [overrides]);

  // The awaited factory is the window in which any re-render of this component makes R3F run it
  // again (R3F configure re-enters while state.gl is unset). Two guards: the factory is
  // idempotent per canvas (a second call joins the in-flight promise), and it writes nothing to
  // React or the store before it returns (the backend is published on a macrotask, after R3F has
  // stored the renderer).
  const makeRenderer = useCallback(
    (props: { canvas?: unknown }) => {
      const canvas = props.canvas as HTMLCanvasElement;
      const existing = inflight.get(canvas);
      if (existing) return existing;
      const promise = (async () => {
        const { WebGPURenderer } = await import("three/webgpu");
        // antialias: the scene pass inherits renderer.samples (4), which the fat lines and the
        // thin rings need for smooth edges
        const renderer = new WebGPURenderer({
          canvas,
          antialias: true,
          powerPreference: "high-performance",
          forceWebGL: !!forceWebGL,
        });
        await renderer.init();
        renderer.setClearColor(new Color(sceneConfig.palette.bgBottom), 1);
        const backend = "isWebGPUBackend" in renderer.backend ? "webgpu" : "webgl";
        setTimeout(() => useSceneStore.getState().setBackend(backend), 0);
        return renderer;
      })();
      inflight.set(canvas, promise);
      return promise;
    },
    [forceWebGL],
  );

  const { position, fov, near, far } = sceneConfig.camera;
  return (
    <div
      className={className}
      data-scene="canvas"
      style={{ position: "relative", overflow: "hidden", background: gradient }}
    >
      {/* `flat` = NoToneMapping. The plan marks every visible material toneMapped:false and its
          post composer never tone-maps, so its palette is meant to reach the screen untouched;
          three/webgpu tone-maps the whole frame once at output (material.toneMapped is inert),
          which only `flat` switches off. Colours still convert linear → sRGB. */}
      <Canvas flat dpr={[1, 2]} camera={{ position, fov, near, far }} gl={makeRenderer}>
        <SceneCamera />
        {layers.background ? <Background /> : null}
        {layers.stars ? <Stars /> : null}
        {layers.bust ? <Bust contours={layers.contours} /> : null}
        {layers.core ? <FaceCore /> : null}
        {layers.neck ? <NeckCircuit /> : null}
        {layers.rings ? <Rings /> : null}
        {layers.landscape ? <Landscape /> : null}
        {layers.post ? <Effects /> : null}
        <FrameTicker onReady={onReady} />
      </Canvas>
      {layers.hud ? <Hud /> : null}
    </div>
  );
}
