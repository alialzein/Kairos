"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Leva, useControls, button } from "leva";
import { AvatarState } from "@twin/shared";
import { AVATAR_STATES, TIER_ORDER, type Tier } from "@twin/config";
import { DEFAULTS } from "@/avatar/sim/frame";
import { bloomParams } from "@/avatar/post/params";
import { useAvatarStore } from "@/avatar/state/store";
import { useEnergyInput } from "@/avatar/audio/useEnergyInput";
import { ENERGY_MODES, type EnergyMode } from "@/avatar/audio/energyMode";

const AvatarCanvas = dynamic(() => import("@/avatar/AvatarCanvas").then((m) => m.AvatarCanvas), {
  ssr: false,
});

const BLOOM_FULL = bloomParams("full", {}) ?? { strength: 0.35, threshold: 3.5, radius: 0.08 };

/**
 * Owns the canvas and the tier override, nothing else. The canvas parent must not re-render while
 * the async WebGPU renderer initialises: a re-render makes R3F run the gl factory a second time on
 * the same canvas and the scene silently stops drawing (three 0.185.1 + R3F 9.7). So everything
 * store-driven (readout, stepper, Leva) lives in sibling components; a tier change is the one
 * allowed re-render and remounts the canvas wholesale through the key.
 */
function CanvasSlot() {
  const [tier, setTier] = useState<Tier | undefined>(undefined);
  return (
    <>
      <AvatarCanvas key={tier ?? "auto"} tier={tier} className="h-full w-full" />
      <label className="absolute bottom-4 left-4 flex items-center gap-2 rounded bg-black/60 p-2 text-xs text-white backdrop-blur">
        tier
        <select
          value={tier ?? "auto"}
          onChange={(e) =>
            setTier(e.target.value === "auto" ? undefined : (e.target.value as Tier))
          }
          className="bg-white/10 px-1"
        >
          <option value="auto">auto</option>
          {TIER_ORDER.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function Overlay() {
  const state = useAvatarStore((s) => s.state);
  const frames = useAvatarStore((s) => s.frames);
  const backend = useAvatarStore((s) => s.backend);
  const activeTier = useAvatarStore((s) => s.tier);
  const setState = useAvatarStore((s) => s.setState);
  const [mode, setMode] = useState<EnergyMode>("none");
  const [file, setFile] = useState<File | null>(null);
  useEnergyInput(mode, file);

  return (
    <aside className="absolute left-4 top-4 flex max-w-xs flex-col gap-3 rounded-lg bg-black/60 p-4 text-sm text-white backdrop-blur">
      <div className="font-mono text-xs opacity-70">
        {backend ?? "…"} · tier {activeTier ?? "…"} · p50 {frames.p50.toFixed(1)} ms · p95{" "}
        {frames.p95.toFixed(1)} ms
      </div>
      <div className="flex flex-wrap gap-1">
        {AvatarState.options.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setState(s)}
            className={`rounded px-2 py-1 text-xs ${s === state ? "bg-twin-core text-black" : "bg-white/10"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs">
        energy
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as EnergyMode)}
          className="bg-white/10 px-1"
        >
          {ENERGY_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      {mode === "file" ? (
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs"
        />
      ) : null}
    </aside>
  );
}

function TuningPanel() {
  const state = useAvatarStore((s) => s.state);
  const setTuning = useAvatarStore((s) => s.setTuning);
  const p = AVATAR_STATES[state];
  const tuning = useControls(
    "simulation",
    {
      turbulence: { value: p.turbulence, min: 0, max: 1, step: 0.01 },
      brightness: { value: p.brightness, min: 0, max: 2, step: 0.01 },
      vortex: { value: p.vortex, min: 0, max: 1, step: 0.01 },
      spring: { value: DEFAULTS.spring, min: 1, max: 40, step: 0.5 },
      damping: { value: DEFAULTS.damping, min: 0.5, max: 0.99, step: 0.005 },
      noiseScale: { value: DEFAULTS.noiseScale, min: 0.2, max: 5, step: 0.05 },
      noiseAmp: { value: DEFAULTS.noiseAmp, min: 0, max: 3, step: 0.05 },
      size: { value: DEFAULTS.size, min: 0.002, max: 0.05, step: 0.001 },
      pointerRadius: { value: DEFAULTS.pointerRadius, min: 0.05, max: 1.5, step: 0.05 },
      // ranges cover the Task 6 defaults: the additive cloud sums past 1.0 in the HDR buffer,
      // so useful thresholds live well above 1 (see post/params.ts)
      bloomStrength: { value: BLOOM_FULL.strength, min: 0, max: 3, step: 0.05 },
      bloomThreshold: { value: BLOOM_FULL.threshold, min: 0, max: 8, step: 0.05 },
      reset: button(() => setTuning({})),
    },
    [state],
  );
  useEffect(() => {
    const values = { ...(tuning as Record<string, unknown>) };
    delete values.reset;
    setTuning(values);
  }, [tuning, setTuning]);
  return <Leva collapsed={false} />;
}

export function DevAvatar() {
  return (
    <main data-theme="dark" className="fixed inset-0 bg-twin-bg">
      <CanvasSlot />
      <Overlay />
      <TuningPanel />
    </main>
  );
}
