import { describe, expect, it } from "vitest";
import { bandEnergy, binRange, energyFrom, smooth, smoothEnergy, ZERO_ENERGY } from "./energy";

describe("binRange", () => {
  it("maps Hz to FFT bins and clamps", () => {
    expect(binRange(48000, 1024, 60, 250)).toEqual([1, 6]);
    expect(binRange(48000, 1024, 2000, 80000)).toEqual([42, 511]);
  });
});

describe("bandEnergy / energyFrom", () => {
  it("averages the bins of the band, normalised to 0..1", () => {
    const freq = new Uint8Array(512);
    for (let i = 2; i <= 4; i++) freq[i] = 255; // 94–188 Hz: inside bass [bins 1..6], outside mid [bins 5..43]
    expect(bandEnergy(freq, 48000, 1024, 60, 250)).toBeCloseTo(0.5);
    expect(bandEnergy(freq, 48000, 1024, 250, 2000)).toBeCloseTo(0);
    const e = energyFrom(freq, 48000, 1024);
    expect(e.bass).toBeCloseTo(0.5);
    expect(e.mid).toBeCloseTo(0);
    expect(e.treble).toBeCloseTo(0);
  });
});

describe("smoothing", () => {
  it("attacks fast and releases slowly", () => {
    expect(smooth(0, 1)).toBeCloseTo(0.5);
    expect(smooth(1, 0)).toBeCloseTo(0.88);
    const s = smoothEnergy(ZERO_ENERGY, { bass: 1, mid: 1, treble: 1 });
    expect(s.mid).toBeCloseTo(0.5);
  });
});
