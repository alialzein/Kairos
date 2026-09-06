import { describe, expect, it } from "vitest";
import { ZERO_ENERGY } from "./energy";
import { energyForMode } from "./energyMode";

describe("energyForMode", () => {
  it("none → zero; synth → synthetic envelope; file/mic → the live reading or zero when absent", () => {
    expect(energyForMode("none", 3, { bass: 1, mid: 1, treble: 1 })).toEqual(ZERO_ENERGY);
    expect(energyForMode("synth", 0.3, null).mid).toBeGreaterThan(0);
    expect(energyForMode("file", 3, { bass: 0.2, mid: 0.4, treble: 0.1 }).mid).toBe(0.4);
    expect(energyForMode("mic", 3, null)).toEqual(ZERO_ENERGY);
  });
});
