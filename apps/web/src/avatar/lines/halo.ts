/** Halo rings (look v2, L5): concentric dashed circles behind the head. Pure geometry —
 *  fat-line segment pairs plus per-segment ring index and rotation direction. */

export const HALO_CENTER: readonly [number, number, number] = [0, 0.42, -0.62];
export const HALO_RINGS: readonly { r: number; dash: number; gap: number; dir: number }[] = [
  { r: 0.62, dash: 0.06, gap: 0.04, dir: 1 },
  { r: 0.8, dash: 0.03, gap: 0.05, dir: -1 },
  { r: 0.98, dash: 0.08, gap: 0.08, dir: 1 },
  { r: 1.16, dash: 0.02, gap: 0.06, dir: -1 },
];
const SEGMENTS_PER_RING = 96;
/** vertical squash so the rings read as a slight ellipse, like the reference */
const SQUASH = 0.94;

export interface HaloGeometry {
  segments: Float32Array;
  segRing: Float32Array;
  segDir: Float32Array;
}

export function haloRingSegments(): HaloGeometry {
  const n = HALO_RINGS.length * SEGMENTS_PER_RING;
  const segments = new Float32Array(n * 6);
  const segRing = new Float32Array(n);
  const segDir = new Float32Array(n);
  let s = 0;
  HALO_RINGS.forEach((ring, k) => {
    for (let i = 0; i < SEGMENTS_PER_RING; i++) {
      const a0 = (i / SEGMENTS_PER_RING) * Math.PI * 2;
      const a1 = ((i + 1) / SEGMENTS_PER_RING) * Math.PI * 2;
      segments[s * 6] = HALO_CENTER[0] + Math.cos(a0) * ring.r;
      segments[s * 6 + 1] = HALO_CENTER[1] + Math.sin(a0) * ring.r * SQUASH;
      segments[s * 6 + 2] = HALO_CENTER[2];
      segments[s * 6 + 3] = HALO_CENTER[0] + Math.cos(a1) * ring.r;
      segments[s * 6 + 4] = HALO_CENTER[1] + Math.sin(a1) * ring.r * SQUASH;
      segments[s * 6 + 5] = HALO_CENTER[2];
      segRing[s] = k;
      segDir[s] = ring.dir;
      s++;
    }
  });
  return { segments, segRing, segDir };
}

/** Spark plume spawn points above the crown: a narrow cone, flat xyz + per-particle seed. */
export function plumePoints(
  n: number,
  rng: () => number,
): { points: Float32Array; seeds: Float32Array } {
  const points = new Float32Array(n * 3);
  const seeds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const spread = rng() * 0.16;
    const a = rng() * Math.PI * 2;
    points[i * 3] = Math.cos(a) * spread;
    points[i * 3 + 1] = 0.86 + rng() * 0.08;
    points[i * 3 + 2] = -0.2 + Math.sin(a) * spread * 0.5;
    seeds[i] = rng();
  }
  return { points, seeds };
}

/** Static starfield far behind everything. */
export function starPoints(n: number, rng: () => number): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = (rng() * 2 - 1) * 6;
    out[i * 3 + 1] = (rng() * 2 - 1) * 3.4;
    out[i * 3 + 2] = -3.5 - rng() * 2.5;
  }
  return out;
}
