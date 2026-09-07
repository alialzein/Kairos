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
import { dprFor, sceneMotionEnabled } from "./motion";
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

/** Sets the camera target (the plan's `lookAt` on mount). R3F only applies position/fov from
 *  the `camera` prop and aims at the origin, so the tilt toward `lookAt` is done here. Phase 9:
 *  the camera drifts ±`motion.cameraDrift.x` on x over `period` (sine), re-aiming every frame
 *  so the composition never moves; still under reduced motion. Uniform updates only. */
function SceneCamera() {
  const camera = useThree((s) => s.camera);
  const drift = useMemo(() => {
    const { cameraDrift } = sceneConfig.motion;
    return sceneMotionEnabled() && cameraDrift.x !== 0 && cameraDrift.period > 0
      ? { x: cameraDrift.x, omega: (Math.PI * 2) / cameraDrift.period }
      : null;
  }, []);
  const baseX = sceneConfig.camera.position[0];
  const [lx, ly, lz] = sceneConfig.camera.lookAt;
  useEffect(() => {
    camera.lookAt(lx, ly, lz);
  }, [camera, lx, ly, lz]);
  // the frame state's camera (not the hook's value) so the lint's immutability rule is happy
  useFrame(({ camera: cam, clock }) => {
    if (!drift) return;
    cam.position.x = baseX + drift.x * Math.sin(clock.elapsedTime * drift.omega);
    cam.lookAt(lx, ly, lz);
  });
  return null;
}

/** Marks the scene ready on its first frame with the bust in the scene (the mesh loads
 *  asynchronously) and publishes p50/p95 frame times every 30 frames. */
function FrameTicker({ waitForBust, onReady }: { waitForBust: boolean; onReady?: () => void }) {
  const stats = useRef(new FrameStats());
  const last = useRef(0);
  const frame = useRef(0);
  const announced = useRef(false);
  useFrame(() => {
    const now = performance.now();
    if (last.current) stats.current.push(now - last.current);
    last.current = now;
    if (!announced.current && (!waitForBust || useSceneStore.getState().bustReady)) {
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

/** the slice of GPUDevice the factory reads (no @webgpu/types in the repo) */
interface LostReporter {
  lost: Promise<{ reason?: string; message: string }>;
}

/** one renderer per canvas element, shared by any re-entrant factory call (see makeRenderer) */
const inflight = new WeakMap<HTMLCanvasElement, Promise<WebGPURenderer>>();
const pendingDispose = new WeakMap<object, ReturnType<typeof setTimeout>>();
/** renderers RendererLifecycle disposed: their "destroyed" device loss is expected, any other
 *  "destroyed" came from the browser (CI's SwiftShader does that ~100 ms after creation) */
const disposedByUs = new WeakSet<object>();

/**
 * Disposes the WebGPU renderer when the Canvas unmounts: R3F's unmount only knows the WebGL
 * renderer's API (renderLists / forceContextLoss), so three's common Renderer is never disposed
 * by it. Deferred by a macrotask and cancelled on an immediate remount so React StrictMode's
 * dev double-mount (cleanup → mount of the same renderer) does not dispose a live renderer.
 */
function RendererLifecycle() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const pending = pendingDispose.get(gl);
    if (pending) {
      clearTimeout(pending);
      pendingDispose.delete(gl);
    }
    return () => {
      pendingDispose.set(
        gl,
        setTimeout(() => {
          pendingDispose.delete(gl);
          inflight.delete(gl.domElement as HTMLCanvasElement);
          disposedByUs.add(gl);
          (gl as unknown as WebGPURenderer).dispose();
          useSceneStore.getState().reset();
        }, 0),
      );
    };
  }, [gl]);
  return null;
}

/**
 * The "Neural Bust" scene (docs/plans/scene-plan.md): the plan's component tree inside one R3F
 * Canvas, each child gated by a layer flag, plus the DOM HUD beside it.
 *
 * Client-only: imports three/webgpu + addons at module level, so consumers must load it through
 * `dynamic(() => import("@/scene/SceneCanvas"), { ssr: false })` (BenchScene does).
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
        // antialias: the scene pass inherits renderer.samples (4 when on), which the fat lines
        // and the thin rings need for smooth edges
        const renderer = new WebGPURenderer({
          canvas,
          antialias: sceneConfig.render.antialias,
          powerPreference: "high-performance",
          forceWebGL: !!forceWebGL,
        });
        await renderer.init();
        renderer.setClearColor(new Color(sceneConfig.palette.bgBottom), 1);
        const backend = "isWebGPUBackend" in renderer.backend ? "webgpu" : "webgl";
        setTimeout(() => useSceneStore.getState().setBackend(backend), 0);
        // a lost WebGPU device is otherwise silent (three logs the non-"destroyed" ones, and
        // nothing reaches the bench): report it as the scene's error unless it is our own dispose
        const device = (renderer.backend as { device?: LostReporter }).device;
        device?.lost.then((info) => {
          if (info.reason === "destroyed" && disposedByUs.has(renderer)) return;
          const message = `webgpu device lost: ${info.reason ?? "unknown"} ${info.message}`;
          console.error(`scene: ${message}`);
          useSceneStore.getState().setError(message);
        });
        return renderer;
      })();
      inflight.set(canvas, promise);
      return promise;
    },
    [forceWebGL],
  );

  const { position, fov, near, far } = sceneConfig.camera;
  // Phase 9 perf: dpr ≤ perf.dprCap below perf.dprCapWidth px, ≤ perf.dprMax above (plan [1, 2])
  const dpr = useMemo(
    () =>
      typeof window === "undefined"
        ? 1
        : dprFor(window.innerWidth, window.devicePixelRatio, sceneConfig.perf),
    [],
  );
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
      <Canvas flat dpr={dpr} camera={{ position, fov, near, far }} gl={makeRenderer}>
        <SceneCamera />
        {layers.background ? <Background /> : null}
        {layers.stars ? <Stars /> : null}
        {layers.bust ? <Bust contours={layers.contours} /> : null}
        {layers.core ? <FaceCore /> : null}
        {layers.neck ? <NeckCircuit /> : null}
        {layers.rings ? <Rings /> : null}
        {layers.landscape ? <Landscape /> : null}
        {layers.post ? <Effects /> : null}
        <FrameTicker waitForBust={layers.bust} onReady={onReady} />
        <RendererLifecycle />
      </Canvas>
      {layers.hud ? <Hud /> : null}
    </div>
  );
}
