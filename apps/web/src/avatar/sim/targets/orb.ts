import type { Rng } from "../random";

/** Fibonacci sphere in three nested shells (docs/06 §2 ORB). */
export function orb(n: number, rng: Rng): Float32Array {
  const shells = [
    { r: 1.0, share: 0.6 },
    { r: 0.72, share: 0.28 },
    { r: 0.45, share: 0.12 },
  ];
  const out = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  let i = 0;
  shells.forEach((sh, si) => {
    const count = si === shells.length - 1 ? n - i : Math.round(n * sh.share);
    for (let k = 0; k < count && i < n; k++, i++) {
      const y = 1 - (2 * (k + 0.5)) / count;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * k;
      const j = 1 + (rng() - 0.5) * 0.02;
      out[i * 3] = Math.cos(th) * rad * sh.r * j;
      out[i * 3 + 1] = y * sh.r * j;
      out[i * 3 + 2] = Math.sin(th) * rad * sh.r * j;
    }
  });
  return out;
}
