import type { Rng } from "../random";

export const HALO_CENTER = [0, 0.42] as const;
export const HALO_RADII = [0.62, 0.88, 1.16] as const;
const HALO_Z = -0.62;

/** Halo rings behind the head (avatar-polish T3): three thin luminous circles facing the
 *  camera, slightly squashed vertically. Static points; the material shimmers and fades
 *  them with the humanoid shade weight. */
export function halo(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r0 = HALO_RADII[i % HALO_RADII.length] as number;
    const r = r0 + (rng() + rng() - 1) * 0.02;
    const theta = rng() * Math.PI * 2;
    out[i * 3] = HALO_CENTER[0] + r * Math.cos(theta);
    out[i * 3 + 1] = HALO_CENTER[1] + r * Math.sin(theta) * 0.94;
    out[i * 3 + 2] = HALO_Z + (rng() - 0.5) * 0.06;
  }
  return out;
}
