import { describe, expect, it } from "vitest";
import { dprFor, landscapeCols, motionEnabled } from "./motion";

describe("motion helpers (Phase 9)", () => {
  it("motionEnabled follows the OS preference on auto and the config otherwise", () => {
    expect(motionEnabled("auto", false)).toBe(true);
    expect(motionEnabled("auto", true)).toBe(false);
    expect(motionEnabled("reduce", false)).toBe(false);
    expect(motionEnabled("full", true)).toBe(true);
  });
  it("dprFor caps the pixel ratio below the width threshold and at dprMax above it", () => {
    const perf = {
      dprCapWidth: 1000,
      dprCap: 1.5,
      dprMax: 2,
      mobileWidth: 768,
      mobileColsFactor: 0.5,
    };
    expect(dprFor(800, 3, perf)).toBe(1.5);
    expect(dprFor(800, 1, perf)).toBe(1);
    expect(dprFor(1400, 3, perf)).toBe(2);
    expect(dprFor(1400, 1.25, perf)).toBe(1.25);
  });
  it("landscapeCols halves the columns on mobile widths", () => {
    const perf = {
      dprCapWidth: 1000,
      dprCap: 1.5,
      dprMax: 2,
      mobileWidth: 768,
      mobileColsFactor: 0.5,
    };
    expect(landscapeCols(500, 70, perf)).toBe(35);
    expect(landscapeCols(768, 70, perf)).toBe(70);
    expect(landscapeCols(1200, 71, perf)).toBe(71);
  });
});
