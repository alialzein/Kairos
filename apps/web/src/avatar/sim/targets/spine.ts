import { ANCHORS } from "../canonical";
import { makeNoise } from "../noise";
import type { Rng } from "../random";

export interface SpineTarget {
  positions: Float32Array;
  /** 0 at the head end, 1 at the chest end (colour gradient amber → blue) */
  t: Float32Array;
}

/** Glowing tendrils from the head down the neck into the chest with short branches. */
export function spine(n: number, rng: Rng): SpineTarget {
  const noise = makeNoise(23);
  const positions = new Float32Array(n * 3);
  const t = new Float32Array(n);
  const branches = 5;
  for (let i = 0; i < n; i++) {
    const s = rng();
    const b = i % branches;
    const bx = (b - (branches - 1) / 2) * 0.05;
    const x =
      ANCHORS.head[0] * (1 - s) +
      ANCHORS.chest[0] * s +
      bx * Math.sin(s * Math.PI) +
      noise(s * 4, b, 0) * 0.04;
    const y = ANCHORS.head[1] * (1 - s) + ANCHORS.chest[1] * s;
    const z = ANCHORS.head[2] * (1 - s) + ANCHORS.chest[2] * s + noise(b, s * 4, 1) * 0.03;
    const r = 0.012 + rng() * 0.012;
    const a = rng() * Math.PI * 2;
    positions[i * 3] = x + Math.cos(a) * r;
    positions[i * 3 + 1] = y + (rng() - 0.5) * 0.01;
    positions[i * 3 + 2] = z + Math.sin(a) * r;
    t[i] = s;
  }
  return { positions, t };
}
