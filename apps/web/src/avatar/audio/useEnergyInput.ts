"use client";
import { useEffect, useRef } from "react";
import { useAvatarStore } from "../state/store";
import { createEnergySource, fileSource, micSource, type EnergySource } from "./analyser";
import { energyForMode, type EnergyMode } from "./energyMode";
import { ZERO_ENERGY } from "./energy";

/** one warning per page: the owner home asks for the mic on every LISTENING, and a denied mic
 *  (or a machine without one — headless CI) must not fill the console */
let warnedOnce = false;

/**
 * Feeds the store's energy from a synthetic envelope, an audio file, or the microphone.
 *
 * Opening an input can fail for ordinary reasons — getUserMedia denied, no capture device, no
 * AudioContext (an unsupported or locked-down browser). None of those is an error the page can
 * act on, so the failure is warned about once and the Avatar simply stays at ZERO energy; it must
 * never surface as an unhandled rejection (the e2e fails the run on any page error, and CI has no
 * microphone at all).
 */
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

    const release = () => {
      source?.dispose();
      source = null;
      stop?.();
      stop = null;
    };

    const open = async () => {
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
    };

    const setup = async () => {
      try {
        await open();
      } catch (err) {
        // denied / no device / no AudioContext — stay silent, never reject
        if (!warnedOnce) {
          warnedOnce = true;
          console.warn(`[avatar] ${mode} energy input unavailable; staying at zero energy`, err);
        }
        release();
        setEnergy(ZERO_ENERGY);
        return;
      }
      // the effect was torn down while the device was opening: hand it straight back
      if (cancelled) {
        release();
        return;
      }
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
      release();
      setEnergy(ZERO_ENERGY);
    };
  }, [mode, file, setEnergy]);
}
