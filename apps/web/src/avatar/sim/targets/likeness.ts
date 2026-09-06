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

/** Rounded-rectangle perimeter point for a lens (t in 0..1). */
function lensPoint(t: number, side: number): [number, number] {
  const a = t * Math.PI * 2;
  // superellipse exponent 4 ≈ rounded rectangle
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const px = Math.sign(cos) * Math.pow(Math.abs(cos), 0.5) * GLASSES.w;
  const py = Math.sign(sin) * Math.pow(Math.abs(sin), 0.5) * GLASSES.h;
  return [side * GLASSES.cx + px, GLASSES.cy + py];
}

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

  // 1. lift the existing scalp into a hairstyle: tall on top, swept up-forward at the front
  //    quiff, faded short on the sides
  for (const i of scalp) {
    const x = positions[i * 3] ?? 0;
    const y = positions[i * 3 + 1] ?? 0;
    const z = positions[i * 3 + 2] ?? 0;
    const side = Math.min(1, Math.abs(x) / 0.26);
    const top = Math.max(0, (y - CROWN_Y) / (0.9 - CROWN_Y));
    const quiff = z > 0.1 && y > 0.62 ? Math.max(0, (z - 0.1) / 0.3) : 0;
    const lift = 0.012 + top * 0.055 + quiff * 0.075 - side * 0.01;
    const nx = normals[i * 3] ?? 0;
    const ny = normals[i * 3 + 1] ?? 0;
    const nz = normals[i * 3 + 2] ?? 0;
    positions[i * 3] = x + nx * lift * 0.6;
    positions[i * 3 + 1] = y + (ny * 0.4 + 0.6) * lift; // biased upward
    positions[i * 3 + 2] = z + (nz * 0.5 + quiff * 0.3) * lift;
    regions[i] = Region.HEAD;
  }

  // 2. reassign low-torso donors to accessories: 7 % hair volume, 2.5 % glasses, 4 % beard
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

  const glassesN = take(0.025);
  for (let k = 0; k < glassesN && cursor < donors.length; k++) {
    const i = next();
    const r = rng();
    let x: number, y: number, z: number;
    if (r < 0.72) {
      // lens rims
      const side = r < 0.36 ? -1 : 1;
      const [lx, ly] = lensPoint(rng(), side);
      x = lx;
      y = ly;
      z = GLASSES.z + (rng() - 0.5) * 0.012;
    } else if (r < 0.82) {
      // bridge
      const t = rng() * 2 - 1;
      x = t * (GLASSES.cx - GLASSES.w) * 0.9;
      y = GLASSES.cy + 0.015 + rng() * 0.01;
      z = GLASSES.z + 0.01;
    } else {
      // temples to the ears
      const side = r < 0.91 ? -1 : 1;
      const t = rng();
      x = side * (GLASSES.cx + GLASSES.w) * (1 - t) + side * 0.29 * t;
      y = GLASSES.cy * (1 - t) + 0.43 * t;
      z = GLASSES.z * (1 - t) + 0.05 * t;
    }
    positions[i * 3] = x + (rng() - 0.5) * 0.006;
    positions[i * 3 + 1] = y + (rng() - 0.5) * 0.006;
    positions[i * 3 + 2] = z;
    normals[i * 3] = 0;
    normals[i * 3 + 1] = 0;
    normals[i * 3 + 2] = 1;
    regions[i] = Region.HEAD; // stable: no speak faceGlow pulsing on the frames
  }

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
