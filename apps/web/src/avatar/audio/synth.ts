import { mulberry32 } from "../sim/random";
import type { Energy } from "./energy";

/**
 * Speech-like envelope for the demo turn: phrases of 1.2–1.8 s with 0.3–0.5 s pauses,
 * ~4 syllables per second. Deterministic per (seed, t).
 */
export function synthEnergy(t: number, seed = 1): Energy {
  const window = Math.floor(t / 2);
  const rng = mulberry32(seed * 1000 + window);
  const phraseLen = 1.2 + rng() * 0.6;
  const phase = t - window * 2;
  const inPhrase = phase < phraseLen;
  const syllable = 0.55 + 0.45 * Math.max(0, Math.sin(t * Math.PI * 2 * 4));
  const env = inPhrase ? syllable * (0.85 + 0.15 * Math.sin(t * 1.7)) : 0;
  const trebleMix = 0.4 + 0.6 * rng();
  return { bass: env * 0.7, mid: env, treble: env * trebleMix };
}
