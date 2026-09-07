import { Mesh, Vector3, type BufferGeometry } from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import type { Rng } from "@/avatar/sim/random";

export interface ShellOptions {
  /** how many points to scatter over the surface */
  count: number;
  /** each point is lifted off the surface by a uniform random distance in this range */
  push: [number, number];
  /** per-point size, PointsMaterial units (uniform random in this range) */
  size: [number, number];
}

export interface ShellPoints {
  /** xyz per point, already pushed along its normal */
  positions: Float32Array;
  /** unit surface normal per point (the shader's fresnel input) */
  normals: Float32Array;
  /** per-point size in the same units as `size` */
  sizes: Float32Array;
  count: number;
}

/**
 * Phase 10.2 (Ali) — the bust's particle shell. `count` points scattered over the mesh with
 * MeshSurfaceSampler (area-weighted, so density is even whatever the triangle sizes), each
 * carrying the interpolated surface normal, lifted `push[0]..push[1]` along that normal so the
 * cloud floats just off the skin and never z-fights the contour mesh underneath, and given a
 * size drawn from `size`. Pure and deterministic for a given rng (the sampler draws through the
 * same generator: 3 numbers per point, then the push, then the size).
 */
export function sampleShell(geometry: BufferGeometry, o: ShellOptions, rng: Rng): ShellPoints {
  const mesh = new Mesh(geometry);
  // @types/three 0.185.4's MeshSurfaceSampler.d.ts predates setRandomGenerator (in the addon
  // since r150) — declare the one method instead of casting the sampler to `any`
  const sampler = new MeshSurfaceSampler(mesh) as MeshSurfaceSampler & {
    setRandomGenerator(fn: Rng): MeshSurfaceSampler;
  };
  sampler.setRandomGenerator(rng);
  sampler.build();

  const positions = new Float32Array(o.count * 3);
  const normals = new Float32Array(o.count * 3);
  const sizes = new Float32Array(o.count);
  const p = new Vector3();
  const n = new Vector3();
  const [pushMin, pushMax] = o.push;
  const [sizeMin, sizeMax] = o.size;
  for (let i = 0; i < o.count; i++) {
    sampler.sample(p, n);
    n.normalize(); // the sampler normalizes the interpolated normal; keep it true of face normals
    const push = pushMin + rng() * (pushMax - pushMin);
    positions[i * 3] = p.x + n.x * push;
    positions[i * 3 + 1] = p.y + n.y * push;
    positions[i * 3 + 2] = p.z + n.z * push;
    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;
    sizes[i] = sizeMin + rng() * (sizeMax - sizeMin);
  }
  return { positions, normals, sizes, count: o.count };
}
