import { mulberry32 } from "./random";

export type Noise3 = (x: number, y: number, z: number) => number;

const GRAD3: readonly (readonly [number, number, number])[] = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
];
const F3 = 1 / 3;
const G3 = 1 / 6;

export function makeNoise(seed: number): Noise3 {
  const rng = mulberry32(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j] ?? 0, p[i] ?? 0];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255] ?? 0;
  const g = (i: number) => GRAD3[(perm[i] ?? 0) % 12] ?? GRAD3[0]!;
  const dot = (v: readonly [number, number, number], x: number, y: number, z: number) =>
    v[0] * x + v[1] * y + v[2] * z;

  return (xin, yin, zin) => {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s),
      j = Math.floor(yin + s),
      k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t),
      y0 = yin - (j - t),
      z0 = zin - (k - t);
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1;
        j1 = 0;
        k1 = 0;
        i2 = 1;
        j2 = 1;
        k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1;
        j1 = 0;
        k1 = 0;
        i2 = 1;
        j2 = 0;
        k2 = 1;
      } else {
        i1 = 0;
        j1 = 0;
        k1 = 1;
        i2 = 1;
        j2 = 0;
        k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0;
        j1 = 0;
        k1 = 1;
        i2 = 0;
        j2 = 1;
        k2 = 1;
      } else if (x0 < z0) {
        i1 = 0;
        j1 = 1;
        k1 = 0;
        i2 = 0;
        j2 = 1;
        k2 = 1;
      } else {
        i1 = 0;
        j1 = 1;
        k1 = 0;
        i2 = 1;
        j2 = 1;
        k2 = 0;
      }
    }
    const x1 = x0 - i1 + G3,
      y1 = y0 - j1 + G3,
      z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3,
      y2 = y0 - j2 + 2 * G3,
      z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3,
      y3 = y0 - 1 + 3 * G3,
      z3 = z0 - 1 + 3 * G3;
    const ii = i & 255,
      jj = j & 255,
      kk = k & 255;
    const corner = (x: number, y: number, z: number, gi: number) => {
      let t0 = 0.6 - x * x - y * y - z * z;
      if (t0 < 0) return 0;
      t0 *= t0;
      return t0 * t0 * dot(g(gi), x, y, z);
    };
    const n0 = corner(x0, y0, z0, ii + (perm[jj + (perm[kk] ?? 0)] ?? 0));
    const n1 = corner(x1, y1, z1, ii + i1 + (perm[jj + j1 + (perm[kk + k1] ?? 0)] ?? 0));
    const n2 = corner(x2, y2, z2, ii + i2 + (perm[jj + j2 + (perm[kk + k2] ?? 0)] ?? 0));
    const n3 = corner(x3, y3, z3, ii + 1 + (perm[jj + 1 + (perm[kk + 1] ?? 0)] ?? 0));
    return 32 * (n0 + n1 + n2 + n3);
  };
}

/** Curl of a noise-derived vector field (three offset samples), divergence-free flow. */
export function curl(
  n: Noise3,
  x: number,
  y: number,
  z: number,
  eps = 0.01,
): [number, number, number] {
  const fx = (a: number, b: number, c: number) => n(a, b, c);
  const fy = (a: number, b: number, c: number) => n(a + 31.7, b + 17.3, c + 5.1);
  const fz = (a: number, b: number, c: number) => n(a - 12.9, b + 43.2, c + 27.5);
  const dFz_dy = (fz(x, y + eps, z) - fz(x, y - eps, z)) / (2 * eps);
  const dFy_dz = (fy(x, y, z + eps) - fy(x, y, z - eps)) / (2 * eps);
  const dFx_dz = (fx(x, y, z + eps) - fx(x, y, z - eps)) / (2 * eps);
  const dFz_dx = (fz(x + eps, y, z) - fz(x - eps, y, z)) / (2 * eps);
  const dFy_dx = (fy(x + eps, y, z) - fy(x - eps, y, z)) / (2 * eps);
  const dFx_dy = (fx(x, y + eps, z) - fx(x, y - eps, z)) / (2 * eps);
  return [dFz_dy - dFy_dz, dFx_dz - dFz_dx, dFy_dx - dFx_dy];
}
