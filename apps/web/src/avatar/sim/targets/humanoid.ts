import { regionsFor, sampleSurfaceWithNormals, type Bounds } from "../sampler";
import type { Rng } from "../random";

export interface BustMesh {
  positions: Float32Array;
  indices: Uint32Array;
  bounds: Bounds;
}

export function humanoid(
  n: number,
  rng: Rng,
  bust: BustMesh,
): { positions: Float32Array; normals: Float32Array; regions: Uint8Array } {
  const { positions, normals } = sampleSurfaceWithNormals(
    bust.positions,
    bust.indices,
    n,
    rng,
    0.012,
  );
  return { positions, normals, regions: regionsFor(positions, bust.bounds) };
}
