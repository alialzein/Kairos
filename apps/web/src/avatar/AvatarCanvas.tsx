"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Color, Vector3, type PerspectiveCamera } from "three";
import type { WebGPURenderer } from "three/webgpu";
import { TIERS, type Tier } from "@twin/config";
import { FrameStats } from "./telemetry/frametime";
import { bloomParams } from "./post/params";
import { createPipeline } from "./post/pipeline";
import { baseTier, parseTierOverride, readSignals, tierFromProbe } from "./tier";
import { loadBust } from "./sim/bust";
import { computeFrame, initialMemory, type FrameMemory } from "./sim/frame";
import { PALETTE } from "./sim/palette";
import { createSim } from "./sim/compute";
import { buildTargets, strided, type Targets } from "./sim/targets";
import { createSimUniforms, writeUniforms } from "./sim/uniforms";
import { createWaves } from "./sim/wavesSystem";
import { mulberry32 } from "./sim/random";
import { createCoreFill } from "./lines/CoreFill";
import { createLineBust } from "./lines/LineBust";
import { createVeinLines } from "./lines/VeinLines";
import { createRidgeVeins } from "./lines/RidgeVeins";
import { createHaloRings } from "./lines/HaloRings";
import { createSparks, createStarfield } from "./lines/Sparks";
import { plumePoints, starPoints } from "./lines/halo";
import { chestNode, mergeTrees, ridgeVeins, spineTree } from "./lines/veins";
import { liftMesh } from "./lines/likenessMesh";
import { sliceMesh, type Contours } from "./lines/slice";
import { useAvatarStore } from "./state/store";

export interface AvatarCanvasProps {
  /** force a tier (tests, playground); otherwise signals + probe decide */
  tier?: Tier;
  forceWebGL?: boolean;
  className?: string;
  /** pointer repulsion / long-press attract / click-to-wake */
  interactive?: boolean;
  onReady?: () => void;
  onWake?: () => void;
}

const SEED = 20260904;
const PROBE_S = 2;

function ParticleSystem({
  targets,
  contours,
  tier,
  onReady,
  onAberration,
}: {
  targets: Targets;
  contours: Contours | null;
  tier: Tier;
  onReady: () => void;
  onAberration: (v: number) => void;
}) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const uniforms = useMemo(() => createSimUniforms(), []);
  const sim = useMemo(() => createSim(targets, uniforms, PALETTE), [targets, uniforms]);
  const wavesN = TIERS[tier].waves;
  const wv = useMemo(
    () => (wavesN > 0 ? createWaves(targets.waves, uniforms, PALETTE) : null),
    [targets, uniforms, wavesN],
  );
  // halo rings (L5: dashed fat lines), spark plume and starfield ride the waves tier gate (off on Low)
  const hl = useMemo(
    () => (wavesN > 0 ? createHaloRings(uniforms, PALETTE) : null),
    [uniforms, wavesN],
  );
  const sp = useMemo(() => {
    if (wavesN === 0) return null;
    const { points, seeds } = plumePoints(1500, mulberry32(SEED + 13));
    return createSparks(points, seeds, uniforms, PALETTE);
  }, [uniforms, wavesN]);
  const st = useMemo(
    () =>
      wavesN > 0
        ? createStarfield(starPoints(5000, mulberry32(SEED + 14)), uniforms, PALETTE)
        : null,
    [uniforms, wavesN],
  );
  // wireframe bust (look v2, L1): contour loops as fat lines, fading in with the humanoid weight
  const lb = useMemo(
    () => (contours ? createLineBust(contours, uniforms, PALETTE) : null),
    [contours, uniforms],
  );
  const cf = useMemo(
    () => (contours ? createCoreFill(uniforms, PALETTE) : null),
    [contours, uniforms],
  );
  // energy veins (L4): spine tree + chest node, orange dashed pulses
  const vn = useMemo(
    () =>
      createVeinLines(
        mergeTrees([spineTree(mulberry32(SEED + 11)), chestNode(mulberry32(SEED + 12))]),
        uniforms,
        PALETTE,
      ),
    [uniforms],
  );
  // ridge veins (L6): orange lightning along the mountain crests, waves tier gate
  const rv = useMemo(
    () =>
      wavesN > 0 ? createRidgeVeins(ridgeVeins(mulberry32(SEED + 15)), uniforms, PALETTE) : null,
    [uniforms, wavesN],
  );
  const memory = useRef<FrameMemory>(initialMemory(useAvatarStore.getState().state));
  const stats = useRef(new FrameStats());
  const last = useRef(0);
  const lastAssemble = useRef(-1);

  useEffect(() => {
    scene.add(sim.sprite);
    if (wv) scene.add(wv.sprite);
    if (hl) scene.add(hl.mesh);
    if (sp) scene.add(sp.sprite);
    if (st) scene.add(st.sprite);
    if (lb) scene.add(lb.mesh);
    if (cf) scene.add(cf.sprite);
    scene.add(vn.mesh);
    if (rv) scene.add(rv.mesh);
    let cancelled = false;
    void gl.computeAsync(sim.init).then(() => {
      if (!cancelled) onReady();
    });
    return () => {
      cancelled = true;
      scene.remove(sim.sprite);
      if (wv) scene.remove(wv.sprite);
      if (hl) scene.remove(hl.mesh);
      if (sp) scene.remove(sp.sprite);
      if (st) scene.remove(st.sprite);
      if (lb) scene.remove(lb.mesh);
      if (cf) scene.remove(cf.sprite);
      scene.remove(vn.mesh);
      if (rv) scene.remove(rv.mesh);
      vn.dispose();
      rv?.dispose();
      sim.dispose();
      wv?.dispose();
      hl?.dispose();
      sp?.dispose();
      st?.dispose();
      lb?.dispose();
      cf?.dispose();
    };
  }, [sim, wv, hl, sp, st, lb, cf, vn, rv, scene, gl, onReady]);

  useFrame((_, dt) => {
    const s = useAvatarStore.getState();
    const now = performance.now() / 1000;
    const r = computeFrame(
      {
        state: s.state,
        since: s.since / 1000,
        now,
        dt,
        energy: s.energy,
        pointer: s.pointer,
        tuning: s.tuning,
      },
      memory.current,
    );
    memory.current = r.memory;
    writeUniforms(uniforms, r.values);
    onAberration(r.values.aberration);
    // HUD "ASSEMBLING… NN%": publish the linear wake progress, quantised so the store only
    // updates when the displayed percentage would change
    const q = Math.round(r.values.assemble * 100) / 100;
    if (q !== lastAssemble.current) {
      lastAssemble.current = q;
      s.setAssemble(q);
    }
    sim.setShapes(r.values.shapeA, r.values.shapeB);
    gl.compute(sim.update);
    if (last.current) stats.current.push((now - last.current) * 1000);
    last.current = now;
    if (stats.current.count % 30 === 0)
      s.setFrames({ p50: stats.current.p50, p95: stats.current.p95, count: stats.current.count });
  });
  return null;
}

function PostPass({ tier, aberration }: { tier: Tier; aberration: React.RefObject<number> }) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const tuning = useAvatarStore((s) => s.tuning);
  const pipe = useMemo(
    // tuning is applied through setBloom below so slider changes don't rebuild the pipeline
    () => createPipeline(gl, scene, camera, { bloom: bloomParams(TIERS[tier].bloom, {}) }),
    [gl, scene, camera, tier],
  );
  useEffect(() => {
    const p = bloomParams(TIERS[tier].bloom, tuning);
    if (p) pipe.setBloom(p);
  }, [pipe, tier, tuning]);
  useEffect(() => () => pipe.dispose(), [pipe]);
  useFrame(() => {
    pipe.setAberration(aberration.current ?? 0);
    pipe.render();
  }, 1); // priority 1: R3F stops auto-rendering; the pipeline draws the frame
  return null;
}

/** Turns pointer events into world-space coordinates on the z = 0 plane. */
function PointerTracker({ onWake }: { onWake?: () => void }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const setPointer = useAvatarStore((s) => s.setPointer);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    const toWorld = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const v = new Vector3(nx, ny, 0.5).unproject(camera);
      const dir = v.sub(camera.position).normalize();
      const t = -camera.position.z / dir.z;
      return camera.position.clone().add(dir.multiplyScalar(t));
    };
    const move = (e: PointerEvent) => {
      const w = toWorld(e);
      setPointer({ x: w.x, y: w.y, active: true });
    };
    const leave = () => setPointer({ active: false, strength: 1 });
    const down = () => {
      pressTimer = setTimeout(() => setPointer({ strength: -1 }), 350);
    };
    const up = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
      setPointer({ strength: 1 });
    };
    const click = () => onWake?.();
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("click", click);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("click", click);
    };
  }, [camera, gl, setPointer, onWake]);
  return null;
}

export function AvatarCanvas({
  tier: tierProp,
  forceWebGL,
  className,
  interactive = true,
  onReady,
  onWake,
}: AvatarCanvasProps) {
  // Computed lazily during the first (client-only) render rather than in an effect: an effect that
  // does nothing but call a state setter synchronously trips react-hooks/set-state-in-effect, and the
  // signal read is a one-time snapshot anyway (window/navigator, not a subscription).
  const [tier, setTierLocal] = useState<Tier | null>(() => {
    if (tierProp) return tierProp;
    if (typeof window === "undefined") return null;
    const override = parseTierOverride(window.location.search);
    return override ?? baseTier(readSignals(navigator, window));
  });
  const [targets, setTargets] = useState<Targets | null>(null);
  // tier-independent, built once from the bust mesh
  const [contours, setContours] = useState<Contours | null>(null);
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const setTier = useAvatarStore((s) => s.setTier);
  const setBackend = useAvatarStore((s) => s.setBackend);
  const setReady = useAvatarStore((s) => s.setReady);
  const probed = useRef(false);
  // written by ParticleSystem's frame step (through the callback so only the owning component
  // mutates it), read by PostPass — deliberately not a SimUniform
  const aberration = useRef(0);
  const setAberration = useCallback((v: number) => {
    aberration.current = v;
  }, []);

  // MUST be referentially stable: R3F re-creates the renderer when the `gl` prop changes, so an
  // inline factory plus any parent re-render (e.g. a page subscribing to the store's frame stats)
  // silently swaps renderers mid-flight — the sim's GPU node caches then straddle two devices and
  // the scene draws nothing while the loop keeps running.
  const makeRenderer = useCallback(
    async (props: { canvas?: unknown }) => {
      const { WebGPURenderer } = await import("three/webgpu");
      const renderer = new WebGPURenderer({
        canvas: props.canvas as HTMLCanvasElement,
        antialias: false,
        powerPreference: "high-performance",
        forceWebGL: !!forceWebGL,
      });
      await renderer.init();
      setBackend("isWebGPUBackend" in renderer.backend ? "webgpu" : "webgl");
      renderer.setClearColor(new Color("#050a18"), 1);
      return renderer;
    },
    [forceWebGL, setBackend],
  );

  // 2. build targets for the tier (once per tier)
  useEffect(() => {
    if (!tier) return;
    let cancelled = false;
    setTier(tier);
    void loadBust().then((raw) => {
      if (cancelled) return;
      // likeness (L3): the hairstyle lives on the mesh so lines and particles agree. Glasses are
      // deliberately OFF (Ali, 2026-09-06: "remove the glasses, I didn't like it") — the
      // generator stays in lines/likenessMesh.ts should he want them back.
      const bust = liftMesh(raw);
      setContours(
        (prev) =>
          prev ??
          sliceMesh(bust.positions, bust.indices, {
            count: 120, // full mesh height (bounds y ±0.9) at ~0.015 spacing, like the reference
            yMin: -0.9,
            yMax: 0.9,
            spacing: 0.012,
          }),
      );
      setTargets((prev) =>
        prev && prev.n >= TIERS[tier].particles
          ? strided(prev, TIERS[tier].particles)
          : buildTargets({ n: TIERS[tier].particles, waves: TIERS[tier].waves, seed: SEED, bust }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [tier, setTier]);

  // 3. pause when hidden; Low tier renders one second then stops
  useEffect(() => {
    const onVis = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const handleReady = useCallback(() => {
    setReady(true);
    onReady?.();
    if (tier === "low") setTimeout(() => setFrameloop("never"), 1000);
    // 4. probe: after 2 s, step down once if p95 is over budget (skipped when a tier was forced)
    if (!tierProp && !probed.current && tier && tier !== "low") {
      probed.current = true;
      setTimeout(() => {
        const next = tierFromProbe(tier, useAvatarStore.getState().frames.p95);
        if (next !== tier) setTierLocal(next);
      }, PROBE_S * 1000);
    }
  }, [tier, tierProp, onReady, setReady]);

  if (!tier || !targets) return <div className={className} data-avatar="loading" />;
  const dprCap = TIERS[tier].dprCap;
  return (
    <div className={className} data-avatar="canvas" data-tier={tier}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, dprCap]}
        camera={{ position: [0, 0.05, 3.6], fov: 34, near: 0.1, far: 50 }}
        gl={makeRenderer}
      >
        <ParticleSystem
          targets={targets}
          contours={contours}
          tier={tier}
          onReady={handleReady}
          onAberration={setAberration}
        />
        <PostPass tier={tier} aberration={aberration} />
        {interactive ? <PointerTracker onWake={onWake} /> : null}
      </Canvas>
    </div>
  );
}
