"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import { layersFromQuery, type LayerQuery } from "@/scene/layers";
import { applyOverrides } from "@/scene/overrides";
import { LAYER_NAMES, sceneConfig, type Layers } from "@/scene/sceneConfig";
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
    };
  }
}

/** Layer checkboxes. Toggling reloads the page with the new `off=` list: a reload is the one
 *  remount path that can never re-render the canvas's parent mid-init (ledger, Task 7). */
function LayerBar({ layers }: { layers: Layers }) {
  const toggle = (name: string) => {
    const next = { ...layers, [name]: !layers[name as keyof Layers] };
    const off = LAYER_NAMES.filter((l) => !next[l]).join(",");
    const url = new URL(window.location.href);
    url.searchParams.delete("phase");
    url.searchParams.delete("only");
    if (off) url.searchParams.set("off", off);
    else url.searchParams.delete("off");
    window.location.assign(url.toString());
  };
  return (
    <form
      data-layer-bar
      className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded bg-black/50 px-2 py-1 font-mono text-[11px] text-white/80 backdrop-blur"
    >
      {LAYER_NAMES.map((l) => (
        <label key={l} className="flex items-center gap-1">
          <input type="checkbox" checked={layers[l]} onChange={() => toggle(l)} />
          {l}
        </label>
      ))}
    </form>
  );
}

/** Public bench page for the scene: `?phase=N`, `?only=a,b`, `?off=a,b`, `?webgl=1`. Publishes
 *  `window.__twinScene` for Playwright and the screenshot scripts. */
export function BenchScene({
  query,
  webgl,
  set,
}: {
  query: LayerQuery;
  webgl: boolean;
  /** `?set=contours.frequency:40,...` tuning overrides applied to sceneConfig before mount
   *  (`layers.*` is ignored — use `phase` / `only` / `off`) */
  set?: string;
}) {
  // stable for the life of the page: the canvas parent must not re-render (ledger, Task 7)
  const layers = useMemo(() => layersFromQuery(query), [query]);
  // sceneConfig is a module singleton; the bench page is reloaded for every change, so mutating
  // the BROWSER's copy once before the canvas mounts is exactly the plan's "apply the named
  // change, re-screenshot". Never on the server: this component is server-rendered too, and a
  // mutation there would leak one request's `?set=` into every later request.
  const applied = useMemo(
    () => (typeof window === "undefined" ? [] : applyOverrides(sceneConfig, set)),
    [set],
  );
  const frames = useRef(0);

  useEffect(() => {
    const publish = () => {
      const s = useSceneStore.getState();
      window.__twinScene = {
        ready: s.ready,
        backend: s.backend,
        error: s.error,
        frames: frames.current,
        stats: s.stats,
        layers,
        applied,
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
      <LayerBar layers={layers} />
    </main>
  );
}
