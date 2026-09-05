import { describe, expect, it } from "vitest";
import { SHAPE_ID } from "@twin/config";
import { PACK_STRIDE, packTargets } from "./pack";
import type { Targets } from "./targets";

function shapeArray(offset: number, n: number): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = offset + i * 10 + 1;
    out[i * 3 + 1] = offset + i * 10 + 2;
    out[i * 3 + 2] = offset + i * 10 + 3;
  }
  return out;
}

const n = 4;
const targets: Targets = {
  n,
  coreEnd: 1,
  spineEnd: 2,
  humanoid: shapeArray(0, n),
  orb: shapeArray(100, n),
  nebula: shapeArray(200, n),
  ring: shapeArray(300, n),
  regions: Uint8Array.from([1, 3, 0, 4]),
  spineT: new Float32Array(n),
  waves: new Float32Array(0),
};

describe("packTargets", () => {
  it("packs all four shapes into one vec4-per-particle buffer, 4·n·4 floats long", () => {
    const packed = packTargets(targets);
    expect(packed.length).toBe(4 * n * PACK_STRIDE);
  });

  it("lays out blocks in SHAPE_ID order: particle i of shape s sits at index (s·n + i)·4", () => {
    const packed = packTargets(targets);
    const at = (shape: number, i: number) => {
      const base = (shape * n + i) * PACK_STRIDE;
      return [packed[base], packed[base + 1], packed[base + 2]];
    };
    expect(at(SHAPE_ID.HUMANOID, 2)).toEqual([21, 22, 23]);
    expect(at(SHAPE_ID.ORB, 2)).toEqual([121, 122, 123]);
    expect(at(SHAPE_ID.NEBULA, 2)).toEqual([221, 222, 223]);
    expect(at(SHAPE_ID.RING, 2)).toEqual([321, 322, 323]);
  });

  it("carries the particle's region in w, the same value in every block", () => {
    const packed = packTargets(targets);
    for (const shape of [SHAPE_ID.HUMANOID, SHAPE_ID.ORB, SHAPE_ID.NEBULA, SHAPE_ID.RING]) {
      for (let i = 0; i < n; i++) {
        const base = (shape * n + i) * PACK_STRIDE;
        expect(packed[base + 3]).toBe(targets.regions[i]);
      }
    }
  });

  it("HUMANOID block xyz equals targets.humanoid; RING block xyz equals targets.ring", () => {
    const packed = packTargets(targets);
    for (let i = 0; i < n; i++) {
      const hBase = (SHAPE_ID.HUMANOID * n + i) * PACK_STRIDE;
      expect([packed[hBase], packed[hBase + 1], packed[hBase + 2]]).toEqual([
        targets.humanoid[i * 3],
        targets.humanoid[i * 3 + 1],
        targets.humanoid[i * 3 + 2],
      ]);
      const rBase = (SHAPE_ID.RING * n + i) * PACK_STRIDE;
      expect([packed[rBase], packed[rBase + 1], packed[rBase + 2]]).toEqual([
        targets.ring[i * 3],
        targets.ring[i * 3 + 1],
        targets.ring[i * 3 + 2],
      ]);
    }
  });
});
