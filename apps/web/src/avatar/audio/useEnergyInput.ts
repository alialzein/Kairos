"use client";
import { useEffect, useRef } from "react";
import { useAvatarStore } from "../state/store";
import { createEnergySource, fileSource, micSource, type EnergySource } from "./analyser";
import { energyForMode, type EnergyMode } from "./energyMode";
import { ZERO_ENERGY } from "./energy";

/** Feeds the store's energy from a synthetic envelope, an audio file, or the microphone. */
export function useEnergyInput(mode: EnergyMode, file: File | null): void {
  const setEnergy = useAvatarStore((s) => s.setEnergy);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let raf = 0;
    let source: EnergySource | null = null;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const t0 = performance.now();

    const ctx = () => (ctxRef.current ??= new AudioContext());

    const setup = async () => {
      if (mode === "file" && file) {
        const f = await fileSource(ctx(), file);
        source = createEnergySource(ctx(), f.node);
        f.start();
        stop = f.stop;
      } else if (mode === "mic") {
        const m = await micSource(ctx());
        source = createEnergySource(ctx(), m.node);
        stop = m.stop;
      }
      if (cancelled) return;
      const tick = () => {
        const live = source ? source.read() : null;
        setEnergy(energyForMode(mode, (performance.now() - t0) / 1000, live));
        raf = requestAnimationFrame(tick);
      };
      if (mode !== "none") raf = requestAnimationFrame(tick);
      else setEnergy(ZERO_ENERGY);
    };
    void setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      source?.dispose();
      stop?.();
      setEnergy(ZERO_ENERGY);
    };
  }, [mode, file, setEnergy]);
}
