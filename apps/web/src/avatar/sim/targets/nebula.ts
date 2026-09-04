import { curl, makeNoise } from "../noise";
import { randomInSphere, type Rng } from "../random";

/** Curl-noise scattered volume (DORMANT / OFFLINE). */
export function nebula(n: number, rng: Rng): Float32Array {
  const noise = makeNoise(11);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = randomInSphere(rng, 1.6);
    const [cx, cy, cz] = curl(noise, x * 0.9, y * 0.9, z * 0.9);
    // curl() returns raw (unbounded) finite-difference derivatives; normalize to a unit flow
    // direction before scaling, so the displacement stays bounded (|P| <= 1.6, |0.35*u| <= 0.35
    // by triangle inequality) regardless of the underlying noise field's local slope.
    const clen = Math.hypot(cx, cy, cz) || 1;
    const ux = cx / clen,
      uy = cy / clen,
      uz = cz / clen;
    out[i * 3] = x + ux * 0.35;
    out[i * 3 + 1] = y * 0.8 + uy * 0.35;
    out[i * 3 + 2] = z + uz * 0.35;
  }
  return out;
}
