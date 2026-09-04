export type Rng = () => number;

/** Small, fast, seedable PRNG (Tommy Ettinger's mulberry32). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomOnSphere(rng: Rng): [number, number, number] {
  const u = rng() * 2 - 1;
  const phi = rng() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(phi), s * Math.sin(phi), u];
}

export function randomInSphere(rng: Rng, r: number): [number, number, number] {
  const [x, y, z] = randomOnSphere(rng);
  const k = Math.cbrt(rng()) * r;
  return [x * k, y * k, z * k];
}
