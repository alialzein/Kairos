import { describe, expect, it } from "vitest";
import { packRegionSpine, packShape } from "./pack";

describe("packShape", () => {
  it("interleaves xyz with the region in w", () => {
    const positions = Float32Array.from([1, 2, 3, 4, 5, 6]);
    const regions = Uint8Array.from([1, 0]);
    expect(Array.from(packShape(positions, regions, 2))).toEqual([1, 2, 3, 1, 4, 5, 6, 0]);
  });

  it("zero-fills when positions are short", () => {
    const block = packShape(Float32Array.from([7, 8, 9]), Uint8Array.from([2, 2]), 2);
    expect(Array.from(block)).toEqual([7, 8, 9, 2, 0, 0, 0, 2]);
  });
});

describe("packRegionSpine", () => {
  it("pairs region with spineT per particle", () => {
    const pairs = packRegionSpine(Uint8Array.from([1, 3]), Float32Array.from([0.25, 0.5]), 2);
    expect(Array.from(pairs)).toEqual([1, 0.25, 3, 0.5]);
  });
});
