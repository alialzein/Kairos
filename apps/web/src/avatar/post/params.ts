import type { Tuning } from "../state/store";

export type BloomMode = "full" | "cheap" | "off";
export interface BloomParams {
  strength: number;
  radius: number;
  threshold: number;
}

/**
 * docs/06 §1: threshold tuned so only the core and spine bloom. The particle cloud is additive,
 * so dense cloud regions sum past 1.0 in the HDR buffer — the threshold sits above that but well
 * below the stacked core sprites, which reach several times brighter.
 */
export function bloomParams(mode: BloomMode, tuning: Tuning): BloomParams | null {
  if (mode === "off") return null;
  const base =
    mode === "full"
      ? { strength: 0.35, radius: 0.08, threshold: 3.5 }
      : { strength: 0.25, radius: 0.05, threshold: 4 };
  return {
    ...base,
    strength: tuning.bloomStrength ?? base.strength,
    threshold: tuning.bloomThreshold ?? base.threshold,
  };
}
