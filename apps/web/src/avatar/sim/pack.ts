import { SHAPE_ID } from "@twin/config";
import type { Targets } from "./targets";

/** Components per packed element: x, y, z, region — see `createSim`'s `shapeAt` in `./compute.ts`. */
export const PACK_STRIDE = 4;

/**
 * The four shape targets packed into ONE vec4 storage buffer, laid out as `n`-particle blocks in
 * SHAPE_ID order (HUMANOID 0, ORB 1, NEBULA 2, RING 3): xyz = that shape's position, w = the
 * particle's region (same value in every block, so any block can supply it). This lets the update
 * kernel touch a single "targets" storage buffer instead of four — three's WebGPU-with-WebGL2-
 * fallback compute emulation hits WebGL2's transform-feedback attribute limit once a kernel
 * references too many storage buffers (positions/velocities/4 shapes/regions = 8 was too many;
 * positions/velocities/targets = 3 is not). Pure data shuffling — no `three` import, so it can be
 * unit-tested directly under Vitest's node environment.
 */
export function packTargets(targets: Targets): Float32Array {
  const { n, regions } = targets;
  const packed = new Float32Array(4 * n * PACK_STRIDE);
  const blocks: Array<[number, Float32Array]> = [
    [SHAPE_ID.HUMANOID, targets.humanoid],
    [SHAPE_ID.ORB, targets.orb],
    [SHAPE_ID.NEBULA, targets.nebula],
    [SHAPE_ID.RING, targets.ring],
  ];
  for (const [shapeId, positions] of blocks) {
    const base = shapeId * n * PACK_STRIDE;
    for (let i = 0; i < n; i++) {
      packed[base + i * PACK_STRIDE] = positions[i * 3] ?? 0;
      packed[base + i * PACK_STRIDE + 1] = positions[i * 3 + 1] ?? 0;
      packed[base + i * PACK_STRIDE + 2] = positions[i * 3 + 2] ?? 0;
      packed[base + i * PACK_STRIDE + 3] = regions[i] ?? 0;
    }
  }
  return packed;
}
