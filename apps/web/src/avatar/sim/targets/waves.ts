import { makeNoise } from "../noise";
import type { Rng } from "../random";

/** Full-width mountain-range heightfield behind the bust (avatar-polish T4): ridged noise
 *  peaks spanning the frame; the near field stays clear of the bust's silhouette. */
export function waves(n: number, rng: Rng): Float32Array {
  const noise = makeNoise(5);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const z = -2.2 + rng() * 2.4;
    let x: number;
    if (z > -0.8) {
      // near field: keep the centre open so the range never crosses the bust
      const side = i % 2 === 0 ? -1 : 1;
      x = side * (1.15 + rng() * 2.0);
    } else {
      x = -3.2 + rng() * 6.4;
    }
    // ridged noise (1 - |n|)² gives sharp crests; farther rows rise higher like a range
    const r = 1 - Math.abs(noise(x * 0.55, z * 0.55, 0));
    const depth = Math.min(1, Math.max(0, (-z - 0.4) / 1.8));
    const y = -0.98 + r * r * (0.22 + 0.45 * depth);
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}
