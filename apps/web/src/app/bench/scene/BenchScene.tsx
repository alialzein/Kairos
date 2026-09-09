"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import { AvatarState } from "@twin/shared";
import { synthEnergy } from "@/avatar/audio/synth";
import { ZERO_ENERGY } from "@/avatar/audio/energy";
import { useAvatarStore } from "@/avatar/state/store";
import { layersFromQuery, type LayerQuery } from "@/scene/layers";
import { applyOverrides } from "@/scene/overrides";
import { sceneConfig, type Layers } from "@/scene/sceneConfig";
import {
  cloneLook,
  copyLook,
  currentLook,
  DEMO_SEQUENCE,
  DEMO_STEP_MS,
  STATE_ORDER,
  type SceneLook,
} from "@/scene/states";
import { useSceneStore } from "@/scene/store";

const SceneCanvas = dynamic(() => import("@/scene/SceneCanvas").then((m) => m.SceneCanvas), {
  ssr: false,
});

declare global {
  interface Window {
    __twinScene?: {
      ready: boolean;
      backend: string | null;
      /** asset load failure (bust mesh), null when fine */
      error: string | null;
      frames: number;
      stats: { p50: number; p95: number; count: number };
      layers: Layers;
      applied: string[];
      /** b5-32: the avatar state the scene is rendering */
      state: string;
      /** b5-32: the blended look this frame. One object, updated in place — read fields, never
       *  hold a reference expecting a snapshot. */
      look: SceneLook;
    };
  }
}

/** how often the demo loop refreshes the fake speech energy while in SPEAKING */
const DEMO_ENERGY_INTERVAL_MS = 90;

/** Public bench page for the scene: `?phase=N`, `?only=a,b`, `?off=a,b`, `?webgl=1` (the layer
 *  checkbox bar was removed at Ali's request, round 1 Phase 7 — nothing but the scene).
 *  b5-32 adds the seven-state controls: `?state=NAME` previews one state, Space / ArrowRight /
 *  ArrowLeft cycle `STATE_ORDER`, `?demo=1` runs `DEMO_SEQUENCE` at `DEMO_STEP_MS`, and
 *  `?hold=<seconds>` pins the state engine's clock for a reproducible still.
 *  Publishes `window.__twinScene` for Playwright and the screenshot scripts. */
export function BenchScene({
  query,
  webgl,
  set,
  state,
  demo,
  hold,
}: {
  query: LayerQuery;
  webgl: boolean;
  /** `?set=contours.frequency:40,...` tuning overrides applied to sceneConfig before mount
   *  (`layers.*` is ignored — use `phase` / `only` / `off`); development builds only */
  set?: string;
  /** `?state=SPEAKING` — an `AvatarState` name; anything else falls back to LISTENING */
  state?: string;
  /** `?demo=1` — cycle `DEMO_SEQUENCE` forever */
  demo?: boolean;
  /** `?hold=2.5` — pin the engine clock this many seconds after the state entry */
  hold?: string;
}) {
  // stable for the life of the page: the canvas parent must not re-render (ledger, Task 7)
  const layers = useMemo(() => layersFromQuery(query), [query]);
  // sceneConfig is a module singleton; the bench page is reloaded for every change, so mutating
  // the BROWSER's copy once before the canvas mounts is exactly the plan's "apply the named
  // change, re-screenshot". Never on the server: this component is server-rendered too, and a
  // mutation there would leak one request's `?set=` into every later request.
  // Phase 14 (Ali): the tuning overrides are a development tool — production builds ignore
  // `?set=` so the approved config is the only one a visitor can see (NODE_ENV is inlined by
  // Next at build time). The layer params (`phase` / `only` / `off` / `webgl`) stay: CI's smoke
  // and the fallback probe use them.
  const applied = useMemo(
    () =>
      typeof window === "undefined" || process.env.NODE_ENV === "production"
        ? []
        : applyOverrides(sceneConfig, set),
    [set],
  );
  const frames = useRef(0);
  const published = useRef<SceneLook>(cloneLook(currentLook));

  // b5-32: the state the canvas mounts into. `SceneCanvas` is a `dynamic(..., { ssr: false })`
  // import, so it mounts on a later commit than this effect — the driver reads the forced state at
  // construction, exactly the way `?set=` lands before the material is built. LISTENING is the
  // default because it is the merged look: without `?state=` the bench renders what shipped.
  useEffect(() => {
    const parsed = AvatarState.safeParse(state);
    useAvatarStore.getState().setState(parsed.success ? parsed.data : "LISTENING");
  }, [state]);

  // `?hold=` lives in the scene store so the driver can read it per frame without a prop
  useEffect(() => {
    const seconds = hold === undefined ? NaN : Number(hold);
    useSceneStore.getState().setHold(Number.isFinite(seconds) ? seconds : null);
    return () => useSceneStore.getState().setHold(null);
  }, [hold]);

  // keyboard: cycle the states. Refs and `getState()` only — a re-render here would re-run the
  // canvas's `gl` factory (ledger, Task 7).
  useEffect(() => {
    if (demo) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const step = e.key === "ArrowLeft" ? -1 : e.key === " " || e.key === "ArrowRight" ? 1 : 0;
      if (!step) return;
      e.preventDefault();
      const i = STATE_ORDER.indexOf(useAvatarStore.getState().state);
      const next = STATE_ORDER[(i + step + STATE_ORDER.length) % STATE_ORDER.length];
      if (next) useAvatarStore.getState().setState(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demo]);

  // `?demo=1`: DORMANT → WAKING → … → OFFLINE → IDLE, looping, with synthetic speech energy while
  // SPEAKING so the core actually moves.
  useEffect(() => {
    if (!demo) return undefined;
    let i = 0;
    const enter = () => {
      const next = DEMO_SEQUENCE[i % DEMO_SEQUENCE.length];
      i += 1;
      if (next) useAvatarStore.getState().setState(next);
    };
    enter();
    const step = setInterval(enter, DEMO_STEP_MS);
    const start = performance.now();
    const energy = setInterval(() => {
      const store = useAvatarStore.getState();
      if (store.state !== "SPEAKING") {
        if (store.energy !== ZERO_ENERGY) store.setEnergy(ZERO_ENERGY);
        return;
      }
      store.setEnergy(synthEnergy((performance.now() - start) / 1000));
    }, DEMO_ENERGY_INTERVAL_MS);
    return () => {
      clearInterval(step);
      clearInterval(energy);
      useAvatarStore.getState().setEnergy(ZERO_ENERGY);
    };
  }, [demo]);

  useEffect(() => {
    const publish = () => {
      const s = useSceneStore.getState();
      copyLook(currentLook, published.current); // one object, written in place: no per-frame garbage
      window.__twinScene = {
        ready: s.ready,
        backend: s.backend,
        error: s.error,
        frames: frames.current,
        stats: s.stats,
        layers,
        applied,
        state: useAvatarStore.getState().state,
        look: published.current,
      };
    };
    const unsub = useSceneStore.subscribe(publish);
    let raf = 0;
    const tick = () => {
      frames.current += 1;
      publish();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [layers, applied]);

  return (
    <main data-theme="dark" data-bench="scene" className="fixed inset-0">
      <SceneCanvas layers={layers} forceWebGL={webgl} className="h-full w-full" />
    </main>
  );
}
