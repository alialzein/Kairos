import { makeNoise } from "../noise";
import type { Rng } from "../random";

/** Two low-frequency heightfield sheets left and right of the bust (background). */
export function waves(n: number, rng: Rng): Float32Array {
  const noise = makeNoise(5);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (1.2 + rng() * 2.0);
    const z = -1.5 + rng() * 2.0;
    const y = -0.9 + noise(x * 0.8, z * 0.8, 0) * 0.35;
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}
