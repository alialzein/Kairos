import type { Rng } from "../random";

/** Torus (70 %) plus two tilted halo annuli (30 %) — the WAKING flourish. */
export function ring(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3);
  const torusCount = Math.round(n * 0.7);
  for (let i = 0; i < torusCount; i++) {
    const u = rng() * Math.PI * 2,
      v = rng() * Math.PI * 2;
    const R = 1.05,
      r = 0.06;
    out[i * 3] = (R + r * Math.cos(v)) * Math.cos(u);
    out[i * 3 + 1] = r * Math.sin(v);
    out[i * 3 + 2] = (R + r * Math.cos(v)) * Math.sin(u);
  }
  for (let i = torusCount; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const rad = 1.3 + rng() * 0.2;
    const tilt = ((i % 2 === 0 ? 1 : -1) * (15 * Math.PI)) / 180;
    const x = Math.cos(a) * rad,
      z = Math.sin(a) * rad;
    out[i * 3] = x;
    out[i * 3 + 1] = z * Math.sin(tilt) + (rng() - 0.5) * 0.02;
    out[i * 3 + 2] = z * Math.cos(tilt);
  }
  return out;
}
