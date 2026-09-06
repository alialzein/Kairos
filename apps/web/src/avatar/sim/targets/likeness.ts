import { Region } from "../sampler";
import type { Rng } from "../random";

/** Likeness v1 (avatar-polish T6): procedural silhouette features calibrated to Ali's photo —
 *  swept-up hair with short sides, rectangular glasses, short full beard. At particle
 *  resolution likeness is carried by silhouette, so these are built onto the sampled bust
 *  instead of reconstructing a mesh from a single photo (ruling in the ledger).
 *
 *  All geometry lives only in the HUMANOID target: reassigned particles keep their other
 *  shape targets, so accessories dissolve with the bust.
 */

export const GLASSES = {
  cy: 0.44, // lens centre height (eye anchors)
  cx: 0.125,
  z: 0.37, // rim plane, just in front of the sockets
  w: 0.095, // half-width of a lens
  h: 0.06, // half-height of a lens
} as const;

const SCALP_Y = 0.55;
const CROWN_Y = 0.66;

const isScalp = (y: number, z: number): boolean => y > SCALP_Y && (z < 0.18 || y > 0.7);
const isJaw = (x: number, y: number, z: number): boolean =>
  y > 0.1 && y < 0.3 && z > 0.15 && Math.abs(x) < 0.32;

export function applyLikeness(
  positions: Float32Array,
  normals: Float32Array,
  regions: Uint8Array,
  rng: Rng,
): void {
  const n = positions.length / 3;
  const scalp: number[] = [];
  const jaw: number[] = [];
  const donors: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3] ?? 0;
    const y = positions[i * 3 + 1] ?? 0;
    const z = positions[i * 3 + 2] ?? 0;
    if (isScalp(y, z)) scalp.push(i);
    else if (isJaw(x, y, z)) jaw.push(i);
    else if (y < -0.15 && regions[i] === Region.CHEST) donors.push(i);
  }
  if (scalp.length === 0 || donors.length === 0) return;

  // 1. (moved) the hairstyle lift now happens on the MESH in lines/likenessMesh.ts so the
  //    sliced line loops and the sampled particles carry the same silhouette; scalp points here
  //    are already lifted and only seed the extra hair-volume dust below.

  // 2. reassign low-torso donors to accessories: 7 % hair volume, 4 % beard
  const take = (frac: number) => Math.min(donors.length, Math.round(n * frac));
  let cursor = 0;
  const next = (): number => donors[cursor++ % donors.length] as number;

  const hairN = take(0.07);
  for (let k = 0; k < hairN && cursor < donors.length; k++) {
    const i = next();
    const src = scalp[Math.floor(rng() * scalp.length)] as number;
    const lift = 0.5 + rng() * 0.9;
    positions[i * 3] = (positions[src * 3] ?? 0) + (rng() - 0.5) * 0.05;
    positions[i * 3 + 1] = (positions[src * 3 + 1] ?? 0) + rng() * 0.05 * lift;
    positions[i * 3 + 2] = (positions[src * 3 + 2] ?? 0) + (rng() - 0.5) * 0.05;
    const px = positions[i * 3] ?? 0;
    const py = positions[i * 3 + 1] ?? 0;
    const pz = positions[i * 3 + 2] ?? 0;
    const len = Math.hypot(px, py - 0.5, pz) || 1;
    normals[i * 3] = px / len;
    normals[i * 3 + 1] = (py - 0.5) / len;
    normals[i * 3 + 2] = pz / len;
    regions[i] = Region.HEAD;
  }

  // 2b. (moved) glasses are drawn as fat-line loops (lines/likenessMesh.ts); GLASSES stays
  //     exported here as the single source of the measured geometry.

  const beardN = jaw.length > 0 ? take(0.04) : 0;
  for (let k = 0; k < beardN && cursor < donors.length; k++) {
    const i = next();
    const src = jaw[Math.floor(rng() * jaw.length)] as number;
    const fuzz = 0.006 + rng() * 0.02;
    const nx = normals[src * 3] ?? 0;
    const ny = normals[src * 3 + 1] ?? 0;
    const nz = normals[src * 3 + 2] ?? 1;
    positions[i * 3] = (positions[src * 3] ?? 0) + nx * fuzz + (rng() - 0.5) * 0.015;
    positions[i * 3 + 1] = (positions[src * 3 + 1] ?? 0) + ny * fuzz + (rng() - 0.5) * 0.015;
    positions[i * 3 + 2] = (positions[src * 3 + 2] ?? 0) + nz * fuzz;
    normals[i * 3] = nx;
    normals[i * 3 + 1] = ny;
    normals[i * 3 + 2] = nz;
    regions[i] = regions[src] ?? Region.FACE;
  }
}
