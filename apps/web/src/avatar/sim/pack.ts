/**
 * One shape's targets as a vec4 block: xyz = position, w = the particle's region (region is
 * per-particle, identical for every shape, so any block can supply it). Blocks are uploaded whole
 * into the kernel's `targetA`/`targetB` slot buffers when a morph endpoint changes — see
 * sim/compute.ts for why the kernel reads slots at `instanceIndex` instead of indexing one packed
 * multi-block buffer.
 */
export function packShape(
  positions: Float32Array,
  regions: ArrayLike<number>,
  n: number,
): Float32Array {
  const block = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    block[i * 4] = positions[i * 3] ?? 0;
    block[i * 4 + 1] = positions[i * 3 + 1] ?? 0;
    block[i * 4 + 2] = positions[i * 3 + 2] ?? 0;
    block[i * 4 + 3] = regions[i] ?? 0;
  }
  return block;
}

/** x = region, y = spine gradient position — the static per-particle pairs the material reads. */
export function packRegionSpine(
  regions: ArrayLike<number>,
  spineT: Float32Array,
  n: number,
): Float32Array {
  const pairs = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pairs[i * 2] = regions[i] ?? 0;
    pairs[i * 2 + 1] = spineT[i] ?? 0;
  }
  return pairs;
}
